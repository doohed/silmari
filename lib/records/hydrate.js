import mongoose from 'mongoose';
import { connectToDatabase } from '@/lib/db/connect';
import { getFieldType } from '@/lib/field-types';
import { owningRelationFields } from '@/lib/relations/service';
import ObjectMetadata from '@/models/ObjectMetadata';
import FieldMetadata from '@/models/FieldMetadata';
import Record from '@/models/Record';
import User from '@/models/User';

/**
 * Calcula la etiqueta identificadora de un registro destino.
 * @param {object} targetRecord
 * @param {object} identifierField
 */
function labelFor(targetRecord, identifierField) {
  if (!identifierField) return '';
  const value = targetRecord?.data?.[identifierField.name];
  const text = getFieldType(identifierField.type).toSearchText(value, identifierField);
  return text || '(sin nombre)';
}

/**
 * Hidrata los campos RELATION (MANY_TO_ONE) de una lista de registros con el
 * `{ id, label }` del registro destino (su labelIdentifier).
 * @param {import('@/lib/auth/permissions').Ctx} ctx
 * @param {{ records: Array<object>, fields: Array<object> }} args
 * @returns {Promise<Array<object>>} registros con `relations` añadido
 */
export async function hydrateRecords(ctx, { records, fields }) {
  const relFields = owningRelationFields(fields);
  const memberFields = fields.filter((f) => f.type === 'MEMBER');
  const hasActor = fields.some((f) => f.type === 'ACTOR');
  const base = records.map((r) => ({
    id: String(r._id),
    data: r.data ?? {},
    position: r.position ?? null,
    createdAt: r.createdAt,
    updatedAt: r.updatedAt,
    createdBy: r.createdBy ?? null,
    relations: {},
  }));
  if ((relFields.length === 0 && memberFields.length === 0 && !hasActor) || base.length === 0) {
    return base;
  }

  await connectToDatabase();

  if (hasActor) await hydrateCreators({ base });
  await hydrateMembers(ctx, { base, memberFields });

  for (const field of relFields) {
    const targetObjectId = field.relation.targetObjectMetadataId;
    // Objeto destino + su campo identificador.
    const targetObject = await ObjectMetadata.findOne({
      _id: targetObjectId,
      workspaceId: ctx.workspaceId,
    })
      .select('labelIdentifierFieldId')
      .lean();
    const identifierField = targetObject?.labelIdentifierFieldId
      ? await FieldMetadata.findById(targetObject.labelIdentifierFieldId).lean()
      : null;

    const ids = base.map((r) => r.data[field.name]).filter(Boolean);
    if (ids.length === 0) continue;

    const targets = await Record.find({
      _id: { $in: ids },
      workspaceId: ctx.workspaceId,
      deletedAt: null,
    }).lean();
    const labelById = new Map(targets.map((t) => [String(t._id), labelFor(t, identifierField)]));

    for (const r of base) {
      const targetId = r.data[field.name];
      r.relations[field.name] = targetId
        ? { id: String(targetId), label: labelById.get(String(targetId)) ?? null }
        : null;
    }
  }

  return base;
}

/**
 * Enriquece el campo de sistema `createdBy` (ACTOR) con el nombre y avatar
 * actuales del usuario que creó el registro, para que "Creado por" muestre a la
 * persona. Los orígenes no humanos (SYSTEM/API, p. ej. datos demo) se quedan sin
 * usuario y el Display los pinta como "Sistema"/"API".
 * @param {{ base: Array<object> }} args
 */
async function hydrateCreators({ base }) {
  const ids = new Set();
  for (const r of base) {
    const uid = r.createdBy?.userId;
    if (uid && mongoose.Types.ObjectId.isValid(String(uid))) ids.add(String(uid));
  }
  if (ids.size === 0) return;

  const users = await User.find({ _id: { $in: [...ids] } })
    .select('firstName lastName avatarUrl')
    .lean();
  const byId = new Map(
    users.map((u) => [
      String(u._id),
      { name: `${u.firstName} ${u.lastName ?? ''}`.trim(), avatarUrl: u.avatarUrl ?? null },
    ]),
  );

  for (const r of base) {
    const uid = r.createdBy?.userId;
    const u = uid && byId.get(String(uid));
    if (u) r.createdBy = { ...r.createdBy, name: u.name, avatarUrl: u.avatarUrl };
  }
}

/**
 * Hidrata los campos MEMBER con `{ id, label, avatarUrl }` del usuario referido.
 * @param {import('@/lib/auth/permissions').Ctx} ctx
 * @param {{ base: Array<object>, memberFields: Array<object> }} args
 */
async function hydrateMembers(ctx, { base, memberFields }) {
  if (memberFields.length === 0) return;
  const ids = new Set();
  for (const r of base) {
    for (const f of memberFields) {
      if (r.data[f.name]) ids.add(String(r.data[f.name]));
    }
  }

  const users = ids.size
    ? await User.find({ _id: { $in: [...ids] } })
        .select('firstName lastName avatarUrl')
        .lean()
    : [];
  const byId = new Map(
    users.map((u) => [
      String(u._id),
      { name: `${u.firstName} ${u.lastName ?? ''}`.trim(), avatarUrl: u.avatarUrl ?? null },
    ]),
  );

  for (const r of base) {
    for (const f of memberFields) {
      const id = r.data[f.name];
      if (!id) {
        r.relations[f.name] = null;
        continue;
      }
      const u = byId.get(String(id));
      r.relations[f.name] = {
        id: String(id),
        label: u?.name || '(desconocido)',
        avatarUrl: u?.avatarUrl ?? null,
      };
    }
  }
}
