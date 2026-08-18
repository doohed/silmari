import mongoose from 'mongoose';
import { connectToDatabase } from '@/lib/db/connect';
import { getFieldType } from '@/lib/field-types';
import { getObjectBySlug } from '@/lib/metadata/object-service';
import { listTimeline } from '@/lib/timeline/service';
import Record from '@/models/Record';
import ObjectMetadata from '@/models/ObjectMetadata';
import FieldMetadata from '@/models/FieldMetadata';
import User from '@/models/User';

const EVENT_VERB = {
  created: 'creó el registro',
  deleted: 'eliminó el registro',
  restored: 'restauró el registro',
};

/** Etiqueta legible del valor de un campo (sin resolver relaciones). */
function formatValue(field, value, relationLabels) {
  if (value === null || value === undefined || value === '') return 'vacío';
  if (field.type === 'RELATION') return relationLabels.get(String(value)) ?? '(registro)';
  if (field.type === 'BOOLEAN') return value ? 'sí' : 'no';
  const text = getFieldType(field.type).toSearchText(value, field);
  return text || String(value);
}

/**
 * Devuelve el timeline de un registro en lenguaje humano.
 * @param {import('@/lib/auth/permissions').Ctx} ctx
 * @param {{ objectSlug: string, recordId: string }} args
 */
export async function listTimelineReadable(ctx, { objectSlug, recordId }) {
  const object = await getObjectBySlug(ctx, objectSlug);
  const fieldByName = Object.fromEntries(object.fields.map((f) => [f.name, f]));
  const items = await listTimeline(ctx, recordId, { limit: 100 });

  // Pre-resuelve labels de relaciones que aparezcan en los diffs.
  const relationIds = new Set();
  for (const it of items) {
    for (const [name, change] of Object.entries(it.diff ?? {})) {
      if (fieldByName[name]?.type === 'RELATION') {
        for (const v of [change.before, change.after]) if (v) relationIds.add(String(v));
      }
    }
  }
  const relationLabels = await resolveRelationLabels(ctx, [...relationIds]);
  const actorNames = await resolveActorNames(items);

  return items.map((it) => {
    const actorName = actorNameFor(it.actor, actorNames);
    let text;
    const changes = [];

    if (it.event === 'updated') {
      for (const [name, change] of Object.entries(it.diff ?? {})) {
        const field = fieldByName[name];
        if (!field) continue;
        changes.push({
          fieldLabel: field.label,
          before: formatValue(field, change.before, relationLabels),
          after: formatValue(field, change.after, relationLabels),
        });
      }
      text =
        changes.length === 1
          ? `cambió ${changes[0].fieldLabel} de ${changes[0].before} a ${changes[0].after}`
          : `actualizó ${changes.length} campos`;
    } else {
      text = EVENT_VERB[it.event] ?? it.event;
    }

    return { id: it.id, createdAt: it.createdAt, actorName, event: it.event, text, changes };
  });
}

/** ¿El actor de un evento es una persona (usuario real, no Sistema/API)? */
function actorIsPerson(actor) {
  return (
    Boolean(actor?.userId) &&
    actor.source !== 'SYSTEM' &&
    actor.source !== 'API' &&
    mongoose.Types.ObjectId.isValid(String(actor.userId))
  );
}

/**
 * Resuelve `userId → nombre` de los actores humanos del timeline, para mostrar
 * quién hizo cada cambio con su nombre actual.
 */
async function resolveActorNames(items) {
  const ids = new Set();
  for (const it of items) {
    if (actorIsPerson(it.actor)) ids.add(String(it.actor.userId));
  }
  if (ids.size === 0) return new Map();
  await connectToDatabase();
  const users = await User.find({ _id: { $in: [...ids] } })
    .select('firstName lastName')
    .lean();
  return new Map(users.map((u) => [String(u._id), `${u.firstName} ${u.lastName ?? ''}`.trim()]));
}

/** Nombre a mostrar del autor de un evento: la persona, o el origen del sistema. */
function actorNameFor(actor, names) {
  if (actorIsPerson(actor)) {
    return names.get(String(actor.userId)) || actor.name || 'Usuario';
  }
  return actor?.name || (actor?.source === 'API' ? 'La API' : 'El sistema');
}

/** Resuelve id → label identificador para una lista de registros. */
async function resolveRelationLabels(ctx, ids) {
  const map = new Map();
  if (ids.length === 0) return map;
  await connectToDatabase();

  const records = await Record.find({ _id: { $in: ids }, workspaceId: ctx.workspaceId }).lean();
  const byObject = new Map();
  for (const r of records) {
    const key = String(r.objectMetadataId);
    if (!byObject.has(key)) byObject.set(key, []);
    byObject.get(key).push(r);
  }

  for (const [objectId, recs] of byObject) {
    const obj = await ObjectMetadata.findById(objectId).select('labelIdentifierFieldId').lean();
    const idField = obj?.labelIdentifierFieldId
      ? await FieldMetadata.findById(obj.labelIdentifierFieldId).lean()
      : null;
    for (const r of recs) {
      const value = idField ? r.data?.[idField.name] : null;
      const label = idField ? getFieldType(idField.type).toSearchText(value, idField) : '';
      map.set(String(r._id), label || '(sin nombre)');
    }
  }
  return map;
}
