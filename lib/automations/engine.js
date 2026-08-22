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
const MAX_DETAIL = 200;

/** Plural del castellano para los detalles del log (`1 persona` / `3 personas`). */
const plural = (n, word) => (n === 1 ? word : `${word}s`);

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
 * Ejecuta una acción y **cuenta qué hizo**. Devolver `{ ok, detail }` en vez de
 * nada es lo que separa «la regla corrió» de «la regla surtió efecto»: una
 * acción `notify` sin destinatarios se ejecutaba sin error y el log la apuntaba
 * como correcta, así que desde fuera era idéntica a una que sí avisó.
 *
 * Importa `records`/`activities` de forma dinámica para romper el ciclo (esos
 * servicios importan el bus, que importa este motor). El `ctx` recibido ya lleva
 * la profundidad incrementada.
 * @returns {Promise<{ ok: boolean, detail: string }>}
 */
async function runAction(ctx, { object, recordId }, action) {
  const cfg = action.config ?? {};
  if (action.type === 'create_task') {
    const { createActivity } = await import('@/lib/activities/service');
    const dueAt =
      cfg.dueInDays != null
        ? new Date(Date.now() + Number(cfg.dueInDays) * 86400000).toISOString()
        : undefined;
    const task = await createActivity(ctx, {
      type: 'TASK',
      title: cfg.title || 'Tarea automática',
      assigneeIds: Array.isArray(cfg.assigneeIds) ? cfg.assigneeIds : [],
      dueAt,
      targets: [{ objectMetadataId: object.id, recordId }],
    });
    const n = task.assigneeIds.length;
    return { ok: true, detail: `Tarea «${task.title}» · ${n} ${plural(n, 'responsable')}` };
  }
  if (action.type === 'update_field') {
    if (!cfg.fieldName) return { ok: false, detail: 'Sin campo configurado' };
    const { updateRecord } = await import('@/lib/records/service');
    await updateRecord(ctx, {
      objectSlug: object.slug,
      recordId,
      data: { [cfg.fieldName]: cfg.value },
    });
    return { ok: true, detail: `${cfg.fieldName} = ${String(cfg.value ?? '')}` };
  }
  if (action.type === 'notify') {
    const sent = await notifyUsers({
      workspaceId: ctx.workspaceId,
      userIds: Array.isArray(cfg.userIds) ? cfg.userIds : [],
      actorId: ctx.userId,
      // Los destinatarios los fijó un ADMIN al escribir la regla, así que el
      // aviso llega aunque el disparo lo provoque el propio destinatario (ver
      // `notifyUsers`). Es también lo único que hace probable la acción en un
      // workspace de un solo miembro.
      excludeActor: false,
      type: 'automation',
      title: cfg.title || 'Automatización',
      body: cfg.body || '',
      entity: { kind: 'record', id: recordId },
      // Al registro, no a la lista: el aviso habla de uno concreto y el id ya
      // lo tenemos aquí.
      url: `/objects/${object.slug}/${recordId}`,
    });
    // Cero destinatarios no es un error, pero tampoco un éxito: la regla se
    // guardó sin nadie a quien avisar y hay que poder verlo en el log.
    return sent === 0
      ? { ok: false, detail: 'Sin destinatarios: no se avisó a nadie' }
      : { ok: true, detail: `Avisadas ${sent} ${plural(sent, 'persona')}` };
  }
  return { ok: false, detail: `Acción desconocida: ${action.type}` };
}

/** Añade una entrada al log de ejecución (capado) sin volver a leer el doc. */
async function appendRunLog(automationId, entry) {
  await Automation.updateOne(
    { _id: automationId },
    { $push: { runLog: { $each: [entry], $slice: -MAX_RUN_LOG } } },
  ).catch((err) => logger.error('No se pudo registrar la ejecución de la automatización', err));
}

/**
 * Anota que la regla se evaluó y las condiciones no casaron. Va a un contador y
 * no al `runLog` a propósito (ver el modelo): sin esto, una regla que no dispara
 * nunca era indistinguible de una que no se está evaluando siquiera.
 */
async function countSkip(automationId) {
  await Automation.updateOne(
    { _id: automationId },
    { $inc: { skippedCount: 1 }, $set: { lastSkippedAt: new Date() } },
  ).catch((err) => logger.error('No se pudo registrar la evaluación de la automatización', err));
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
    // Fuera del `try` para que, si una acción revienta, el log conserve lo que
    // sí llegó a hacerse antes. Antes el catch apuntaba `actionsRun: 0` y una
    // regla de tres acciones que fallaba en la tercera parecía no haber hecho nada.
    const details = [];
    try {
      if (!(await conditionsMatch(ctx, object, recordId, automation.conditions))) {
        await countSkip(automation._id);
        continue;
      }
      for (const action of automation.actions) {
        const result = await runAction(actionCtx, { object, recordId }, action);
        details.push({
          action: action.type,
          ok: result.ok,
          detail: String(result.detail ?? '').slice(0, MAX_DETAIL),
        });
      }
      await appendRunLog(automation._id, {
        at: new Date(),
        recordId,
        ok: true,
        actionsRun: details.length,
        details,
      });
    } catch (err) {
      logger.error(`Automatización "${automation.name}" falló`, err);
      await appendRunLog(automation._id, {
        at: new Date(),
        recordId,
        ok: false,
        actionsRun: details.length,
        details,
        error: String(err?.message ?? err).slice(0, 300),
      });
    }
  }
}
