import { connectToDatabase } from '@/lib/db/connect';
import { assertTenant } from '@/lib/services/tenant';
import { can } from '@/lib/auth/permissions';
import { ForbiddenError, NotFoundError, ValidationError } from '@/lib/errors/domain-errors';
import { getObjectBySlug } from '@/lib/metadata/object-service';
import { getFieldType } from '@/lib/field-types';
import Automation from '@/models/Automation';

/** Eventos de disparo admitidos (los que emite records/service). */
export const TRIGGER_EVENTS = ['record.created', 'record.updated'];
/** Tipos de acción admitidos por el ejecutor (lib/automations/engine). */
export const ACTION_TYPES = ['create_task', 'update_field', 'notify'];

function toAutomationDTO(a) {
  return {
    id: String(a._id),
    name: a.name,
    enabled: a.enabled,
    trigger: { event: a.trigger.event, objectSlug: a.trigger.objectSlug },
    conditions: (a.conditions ?? []).map((c) => ({
      fieldName: c.fieldName,
      operator: c.operator,
      value: c.value,
    })),
    actions: (a.actions ?? []).map((ac) => ({ type: ac.type, config: ac.config ?? {} })),
    runLog: (a.runLog ?? [])
      .slice()
      .reverse()
      .slice(0, 10)
      .map((r) => ({
        id: String(r._id),
        at: r.at,
        recordId: r.recordId,
        ok: r.ok,
        actionsRun: r.actionsRun,
        error: r.error ?? null,
      })),
  };
}

/**
 * Valida y normaliza el cuerpo de una automatización contra la metadata real del
 * objeto (nunca se confía en lo que manda el cliente). Devuelve el objeto ya
 * resuelto para reusarlo.
 */
async function validateBody(ctx, { name, trigger, conditions, actions }) {
  if (!name || !name.trim()) {
    throw new ValidationError('La automatización necesita un nombre', {
      fieldErrors: { name: ['Escribe un nombre'] },
    });
  }
  if (!trigger || !TRIGGER_EVENTS.includes(trigger.event)) {
    throw new ValidationError('Disparador no válido');
  }
  const object = await getObjectBySlug(ctx, trigger.objectSlug); // lanza NotFoundError
  const byName = new Map(object.fields.map((f) => [f.name, f]));

  const normConditions = (conditions ?? []).map((c) => {
    const field = byName.get(c.fieldName);
    if (!field) throw new ValidationError(`Campo de condición desconocido: ${c.fieldName}`);
    const def = getFieldType(field.type);
    if (!def.filterOperators.includes(c.operator)) {
      throw new ValidationError(`Operador "${c.operator}" no válido para "${c.fieldName}"`);
    }
    return { fieldName: c.fieldName, operator: c.operator, value: c.value ?? null };
  });

  const normActions = (actions ?? []).map((ac) => {
    if (!ACTION_TYPES.includes(ac.type)) {
      throw new ValidationError(`Tipo de acción desconocido: ${ac.type}`);
    }
    if (ac.type === 'update_field') {
      const field = byName.get(ac.config?.fieldName);
      if (!field)
        throw new ValidationError('La acción de actualizar campo necesita un campo válido');
    }
    return { type: ac.type, config: ac.config ?? {} };
  });
  if (normActions.length === 0) throw new ValidationError('Añade al menos una acción');

  return { object, name: name.trim(), trigger, conditions: normConditions, actions: normActions };
}

/** Crea una automatización. */
export async function createAutomation(ctx, input) {
  assertTenant(ctx);
  if (!can(ctx, 'automations:manage'))
    throw new ForbiddenError('No puedes gestionar automatizaciones');
  const body = await validateBody(ctx, input ?? {});
  await connectToDatabase();
  const doc = await Automation.create({
    workspaceId: ctx.workspaceId,
    name: body.name,
    enabled: input.enabled ?? true,
    trigger: { event: body.trigger.event, objectSlug: body.trigger.objectSlug },
    conditions: body.conditions,
    actions: body.actions,
  });
  return toAutomationDTO(doc);
}

/** Lista las automatizaciones del workspace. */
export async function listAutomations(ctx) {
  assertTenant(ctx);
  if (!can(ctx, 'automations:manage'))
    throw new ForbiddenError('No puedes gestionar automatizaciones');
  await connectToDatabase();
  const items = await Automation.find({ workspaceId: ctx.workspaceId }).sort({ createdAt: -1 });
  return items.map(toAutomationDTO);
}

async function loadAutomation(ctx, id) {
  const a = await Automation.findOne({ _id: id, workspaceId: ctx.workspaceId });
  if (!a) throw new NotFoundError('Automatización no encontrada');
  return a;
}

/** Actualiza una automatización (reemplaza disparador/condiciones/acciones). */
export async function updateAutomation(ctx, id, input) {
  assertTenant(ctx);
  if (!can(ctx, 'automations:manage'))
    throw new ForbiddenError('No puedes gestionar automatizaciones');
  await connectToDatabase();
  const a = await loadAutomation(ctx, id);
  const body = await validateBody(ctx, {
    name: input.name ?? a.name,
    trigger: input.trigger ?? a.trigger,
    conditions: input.conditions ?? a.conditions,
    actions: input.actions ?? a.actions,
  });
  a.name = body.name;
  a.trigger = { event: body.trigger.event, objectSlug: body.trigger.objectSlug };
  a.conditions = body.conditions;
  a.actions = body.actions;
  if (input.enabled !== undefined) a.enabled = input.enabled;
  await a.save();
  return toAutomationDTO(a);
}

/** Activa/desactiva una automatización. */
export async function toggleAutomation(ctx, id) {
  assertTenant(ctx);
  if (!can(ctx, 'automations:manage'))
    throw new ForbiddenError('No puedes gestionar automatizaciones');
  await connectToDatabase();
  const a = await loadAutomation(ctx, id);
  a.enabled = !a.enabled;
  await a.save();
  return toAutomationDTO(a);
}

/** Borra una automatización. */
export async function deleteAutomation(ctx, id) {
  assertTenant(ctx);
  if (!can(ctx, 'automations:manage'))
    throw new ForbiddenError('No puedes gestionar automatizaciones');
  await connectToDatabase();
  const a = await loadAutomation(ctx, id);
  await a.deleteOne();
}
