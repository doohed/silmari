import { connectToDatabase } from '@/lib/db/connect';
import { getObjectBySlug } from '@/lib/metadata/object-service';
import { getFieldType } from '@/lib/field-types';
import { coerceFilterValue } from '@/lib/field-types/helpers';
import { notifyUsers } from '@/lib/notifications/service';
import { logger } from '@/lib/utils/logger';
import Automation from '@/models/Automation';
import Record from '@/models/Record';

// Corta cadenas de automatizaciones que se disparan entre sí (una regla que
// actualiza un campo y vuelve a casar su propio disparador). La profundidad
// viaja en `ctx._automationDepth` → `event.meta.automationDepth` (ver el bus).
const MAX_DEPTH = 5;
const MAX_RUN_LOG = 20;

/**
 * ¿Cumple el registro las condiciones? Se evalúan **re-consultando** el registro
 * con los filtros construidos por los field-types (`buildFilter`): cero
 * duplicación de la lógica de operadores. Sin condiciones → siempre cumple.
 */
async function conditionsMatch(ctx, object, recordId, conditions) {
  if (!conditions || conditions.length === 0) return true;
  const byName = new Map(object.fields.map((f) => [f.name, f]));
  const and = [];
  for (const c of conditions) {
    const field = byName.get(c.fieldName);
    if (!field) return false; // el campo pudo borrarse tras crear la regla
    const def = getFieldType(field.type);
    if (!def.filterOperators.includes(c.operator)) return false;
    // Misma coacción que en `query-builder`: la condición la guardó un ADMIN,
    // pero sigue siendo entrada del cliente y acaba en un match de Mongo.
    and.push(
      def.buildFilter(field.name, c.operator, coerceFilterValue(c.value, c.operator), field),
    );
  }
  const found = await Record.findOne({
    _id: recordId,
    workspaceId: ctx.workspaceId,
    objectMetadataId: object.id,
    deletedAt: null,
    ...(and.length ? { $and: and } : {}),
  })
    .select('_id')
    .lean();
  return Boolean(found);
}

/**
 * Ejecuta una acción. Importa `records`/`activities` de forma dinámica para
 * romper el ciclo (esos servicios importan el bus, que importa este motor).
 * El `ctx` recibido ya lleva la profundidad incrementada.
 */
async function runAction(ctx, { object, recordId }, action) {
  const cfg = action.config ?? {};
  if (action.type === 'create_task') {
    const { createActivity } = await import('@/lib/activities/service');
    const dueAt =
      cfg.dueInDays != null
        ? new Date(Date.now() + Number(cfg.dueInDays) * 86400000).toISOString()
        : undefined;
    await createActivity(ctx, {
      type: 'TASK',
      title: cfg.title || 'Tarea automática',
      assigneeIds: Array.isArray(cfg.assigneeIds) ? cfg.assigneeIds : [],
      dueAt,
      targets: [{ objectMetadataId: object.id, recordId }],
    });
    return;
  }
  if (action.type === 'update_field') {
    if (!cfg.fieldName) return;
    const { updateRecord } = await import('@/lib/records/service');
    await updateRecord(ctx, {
      objectSlug: object.slug,
      recordId,
      data: { [cfg.fieldName]: cfg.value },
    });
    return;
  }
  if (action.type === 'notify') {
    await notifyUsers({
      workspaceId: ctx.workspaceId,
      userIds: Array.isArray(cfg.userIds) ? cfg.userIds : [],
      actorId: ctx.userId,
      type: 'automation',
      title: cfg.title || 'Automatización',
      body: cfg.body || '',
      entity: { kind: 'record', id: recordId },
      url: `/objects/${object.slug}`,
    });
  }
}

/** Añade una entrada al log de ejecución (capado) sin volver a leer el doc. */
async function appendRunLog(automationId, entry) {
  await Automation.updateOne(
    { _id: automationId },
    { $push: { runLog: { $each: [entry], $slice: -MAX_RUN_LOG } } },
  ).catch((err) => logger.error('No se pudo registrar la ejecución de la automatización', err));
}

/**
 * Corre todas las automatizaciones que casan con un evento de registro. Es la
 * función que llama el suscriptor; también se puede invocar directamente (tests).
 * @param {import('@/lib/auth/permissions').Ctx} ctx
 * @param {import('@/lib/events/bus').DomainEvent} event
 */
export async function runAutomationsForEvent(ctx, event) {
  if (!event?.object?.slug) return;
  const depth = event.meta?.automationDepth ?? 0;
  if (depth >= MAX_DEPTH) {
    logger.warn(`Automatizaciones: profundidad máxima (${MAX_DEPTH}) alcanzada, se corta`);
    return;
  }
  const recordId = event.payload?.id;
  if (!recordId) return;

  await connectToDatabase();
  const automations = await Automation.find({
    workspaceId: ctx.workspaceId,
    enabled: true,
    'trigger.event': event.type,
    'trigger.objectSlug': event.object.slug,
  });
  if (automations.length === 0) return;

  const object = await getObjectBySlug(ctx, event.object.slug);
  // ctx para las acciones: mismo tenant/actor, con la profundidad incrementada
  // para que las mutaciones que provoque no reboten sin control.
  const actionCtx = { ...ctx, _automationDepth: depth + 1 };

  for (const automation of automations) {
    try {
      if (!(await conditionsMatch(ctx, object, recordId, automation.conditions))) continue;
      let ran = 0;
      for (const action of automation.actions) {
        await runAction(actionCtx, { object, recordId }, action);
        ran += 1;
      }
      await appendRunLog(automation._id, { at: new Date(), recordId, ok: true, actionsRun: ran });
    } catch (err) {
      logger.error(`Automatización "${automation.name}" falló`, err);
      await appendRunLog(automation._id, {
        at: new Date(),
        recordId,
        ok: false,
        actionsRun: 0,
        error: String(err?.message ?? err).slice(0, 300),
      });
    }
  }
}
