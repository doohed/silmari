import { connectToDatabase } from '@/lib/db/connect';
import { assertTenant } from '@/lib/services/tenant';
import { can } from '@/lib/auth/permissions';
import { ForbiddenError, NotFoundError, ValidationError } from '@/lib/errors/domain-errors';
import { getObjectBySlug } from '@/lib/metadata/object-service';
import { getRecord } from '@/lib/records/service';
import { getFieldType } from '@/lib/field-types';
import { renderTemplate } from '@/lib/templates/render';
import MessageTemplate from '@/models/MessageTemplate';

const CHANNELS = ['EMAIL', 'WHATSAPP', 'GENERIC'];

function toTemplateDTO(t) {
  return {
    id: String(t._id),
    name: t.name,
    channel: t.channel,
    objectSlug: t.objectSlug ?? null,
    subject: t.subject ?? '',
    body: t.body ?? '',
  };
}

/**
 * Mapa de variables `{{campo}}` a partir de un registro hidratado: cada campo se
 * pasa a texto plano con el `toSearchText` de su tipo. Añade `actor.name` del
 * contexto. Puro respecto a BD (recibe objeto + registro ya cargados).
 * @param {{ fields: Array }} object
 * @param {{ data: object }} record
 * @param {{ actorName?: string }} [ctx]
 */
export function buildRecordVariables(object, record, ctx = {}) {
  const vars = {};
  for (const field of object.fields) {
    const value = record.data?.[field.name];
    vars[field.name] = getFieldType(field.type).toSearchText(value, field);
  }
  vars['actor.name'] = ctx.actorName ?? '';
  return vars;
}

/** Crea una plantilla. */
export async function createTemplate(ctx, input) {
  assertTenant(ctx);
  if (!can(ctx, 'templates:manage')) throw new ForbiddenError('No puedes gestionar plantillas');
  if (!input?.name?.trim()) {
    throw new ValidationError('La plantilla necesita un nombre', {
      fieldErrors: { name: ['Escribe un nombre'] },
    });
  }
  if (!input?.body?.trim()) {
    throw new ValidationError('La plantilla necesita un cuerpo', {
      fieldErrors: { body: ['Escribe el mensaje'] },
    });
  }
  const channel = CHANNELS.includes(input.channel) ? input.channel : 'EMAIL';
  // Si se acota a un objeto, comprobamos que existe (no confiamos en el cliente).
  if (input.objectSlug) await getObjectBySlug(ctx, input.objectSlug);

  await connectToDatabase();
  const doc = await MessageTemplate.create({
    workspaceId: ctx.workspaceId,
    name: input.name.trim(),
    channel,
    objectSlug: input.objectSlug || null,
    subject: channel === 'EMAIL' ? (input.subject ?? '') : '',
    body: input.body,
  });
  return toTemplateDTO(doc);
}

/** Lista las plantillas del workspace (opcionalmente por canal). */
export async function listTemplates(ctx, { channel } = {}) {
  assertTenant(ctx);
  if (!can(ctx, 'templates:manage')) throw new ForbiddenError('No puedes gestionar plantillas');
  await connectToDatabase();
  const query = { workspaceId: ctx.workspaceId };
  if (channel) query.channel = channel;
  const items = await MessageTemplate.find(query).sort({ createdAt: -1 });
  return items.map(toTemplateDTO);
}

/**
 * Lista plantillas para **redactar** un mensaje (solo lectura, sin gate de
 * administración): cualquier miembro puede elegir una plantilla existente al
 * componer. La gestión (crear/editar/borrar) sigue siendo de ADMIN.
 * @param {import('@/lib/auth/permissions').Ctx} ctx
 * @param {{ channel?: string }} [opts]
 */
export async function listTemplatesForCompose(ctx, { channel } = {}) {
  assertTenant(ctx);
  await connectToDatabase();
  const query = { workspaceId: ctx.workspaceId };
  if (channel) query.channel = channel;
  const items = await MessageTemplate.find(query).sort({ name: 1 });
  return items.map(toTemplateDTO);
}

async function loadTemplate(ctx, id) {
  const t = await MessageTemplate.findOne({ _id: id, workspaceId: ctx.workspaceId });
  if (!t) throw new NotFoundError('Plantilla no encontrada');
  return t;
}

/** Actualiza una plantilla. */
export async function updateTemplate(ctx, id, patch) {
  assertTenant(ctx);
  if (!can(ctx, 'templates:manage')) throw new ForbiddenError('No puedes gestionar plantillas');
  await connectToDatabase();
  const t = await loadTemplate(ctx, id);
  if (patch.name !== undefined) {
    if (!patch.name.trim()) throw new ValidationError('El nombre no puede quedar vacío');
    t.name = patch.name.trim();
  }
  if (patch.channel !== undefined && CHANNELS.includes(patch.channel)) t.channel = patch.channel;
  if (patch.objectSlug !== undefined) {
    if (patch.objectSlug) await getObjectBySlug(ctx, patch.objectSlug);
    t.objectSlug = patch.objectSlug || null;
  }
  if (patch.subject !== undefined) t.subject = t.channel === 'EMAIL' ? patch.subject : '';
  if (patch.body !== undefined) {
    if (!patch.body.trim()) throw new ValidationError('El cuerpo no puede quedar vacío');
    t.body = patch.body;
  }
  await t.save();
  return toTemplateDTO(t);
}

/** Borra una plantilla. */
export async function deleteTemplate(ctx, id) {
  assertTenant(ctx);
  if (!can(ctx, 'templates:manage')) throw new ForbiddenError('No puedes gestionar plantillas');
  await connectToDatabase();
  const t = await loadTemplate(ctx, id);
  await t.deleteOne();
}

/**
 * Renderiza una plantilla contra un registro concreto. Es la capacidad que
 * consumirán el email integrado y WhatsApp al componer un mensaje. Devuelve el
 * asunto y cuerpo ya sustituidos.
 * @param {import('@/lib/auth/permissions').Ctx} ctx
 * @param {{ templateId: string, objectSlug: string, recordId: string }} args
 * @returns {Promise<{ channel: string, subject: string, body: string }>}
 */
export async function renderForRecord(ctx, { templateId, objectSlug, recordId }) {
  assertTenant(ctx);
  await connectToDatabase();
  const t = await loadTemplate(ctx, templateId);
  const object = await getObjectBySlug(ctx, objectSlug);
  const record = await getRecord(ctx, { objectSlug, recordId });
  const vars = buildRecordVariables(object, record, ctx);
  return {
    channel: t.channel,
    subject: renderTemplate(t.subject, vars),
    body: renderTemplate(t.body, vars),
  };
}
