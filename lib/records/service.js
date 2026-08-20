import mongoose from 'mongoose';
import { generateKeyBetween, generateNKeysBetween } from 'fractional-indexing';
import { connectToDatabase } from '@/lib/db/connect';
import { assertTenant } from '@/lib/services/tenant';
import { NotFoundError, ValidationError } from '@/lib/errors/domain-errors';
import { getObjectBySlug } from '@/lib/metadata/object-service';
import { validateAndNormalize } from '@/lib/records/validate';
import { buildSearchText } from '@/lib/records/search-text';
import { buildQuery, buildNextCursor } from '@/lib/records/query-builder';
import { encodeCursor, decodeCursor } from '@/lib/utils/cursor';
import { hydrateRecords } from '@/lib/records/hydrate';
import { formulaDependencies } from '@/lib/field-types/formula-eval';
import { syncRecordRelations, removeRecordRelations } from '@/lib/relations/service';
import { logEvent, diffData } from '@/lib/timeline/service';
import { emitDomainEvent, recordEvent } from '@/lib/events';
import { getFieldType } from '@/lib/field-types';
import { assertWithinPlan } from '@/lib/billing/limits';
import { escapeRegex } from '@/lib/field-types/helpers';
import { MAX_IMPORT_ROWS, MAX_BULK_IDS } from '@/lib/records/limits';
import Record from '@/models/Record';
import ObjectMetadata from '@/models/ObjectMetadata';
import FieldMetadata from '@/models/FieldMetadata';

const MAX_LIMIT = 200;

/** Resuelve un objeto + sus campos por slug (siempre del servidor). */
async function resolveObject(ctx, objectSlug) {
  return getObjectBySlug(ctx, objectSlug); // lanza NotFoundError si no existe
}

/**
 * Valida el tamaño de una lista de ids en una operación masiva.
 * @param {unknown} recordIds
 * @returns {string[]}
 */
export function assertBulkSize(recordIds) {
  const ids = Array.isArray(recordIds) ? recordIds : [];
  if (ids.length > MAX_BULK_IDS) {
    throw new ValidationError(
      `Solo se pueden procesar ${MAX_BULK_IDS} registros a la vez. Selecciona menos.`,
    );
  }
  return ids;
}

/** Siguiente posición fraccional (string) al final del objeto. */
async function nextPosition(ctx, objectMetadataId, session) {
  const last = await Record.findOne({ workspaceId: ctx.workspaceId, objectMetadataId })
    .sort({ position: -1 })
    .select('position')
    .session(session ?? null)
    .lean();
  return generateKeyBetween(last?.position ?? null, null);
}

/**
 * Crea un registro validado contra la metadata del objeto.
 * @param {import('@/lib/auth/permissions').Ctx} ctx
 * @param {{ objectSlug: string, data: object, source?: string }} args
 */
export async function createRecord(ctx, { objectSlug, data, source = 'MANUAL' }) {
  assertTenant(ctx);
  // El tope de registros del plan se comprueba aquí, que es por donde pasan
  // tanto la UI como la API pública y la ingesta de leads.
  await assertWithinPlan(ctx, 'records');
  const object = await resolveObject(ctx, objectSlug);

  // Valor por defecto del identificador TEXT (permite "creación rápida" con {}).
  const input = { ...(data ?? {}) };
  const idField = object.fields.find((f) => f.id === object.labelIdentifierFieldId);
  if (idField?.type === 'TEXT' && !input[idField.name]) input[idField.name] = 'Sin título';

  const normalized = validateAndNormalize(object.fields, input, { partial: false });

  // Los campos MEMBER sin valor se rellenan con el creador solo si es un usuario
  // real (ObjectId válido); los actores no humanos (API key, formulario público)
  // no se autoasignan. Editable después.
  if (mongoose.Types.ObjectId.isValid(String(ctx.userId))) {
    for (const f of object.fields) {
      if (f.type === 'MEMBER' && normalized[f.name] == null) normalized[f.name] = ctx.userId;
    }
  }

  const searchText = buildSearchText(object.fields, normalized);

  const session = await mongoose.startSession();
  let recordId;
  try {
    await session.withTransaction(async () => {
      const position = await nextPosition(ctx, object.id, session);
      const [record] = await Record.create(
        [
          {
            workspaceId: ctx.workspaceId,
            objectMetadataId: object.id,
            data: normalized,
            position,
            searchText,
            createdBy: { userId: ctx.userId, name: ctx.actorName ?? '', source },
          },
        ],
        { session },
      );
      recordId = record._id;
      await syncRecordRelations(
        ctx,
        { recordId, data: normalized, fields: object.fields },
        { session },
      );
      await logEvent(
        ctx,
        {
          recordId,
          objectMetadataId: object.id,
          event: 'created',
          diff: diffData({}, normalized),
          actor: { userId: ctx.userId, name: ctx.actorName ?? '', source },
        },
        { session },
      );
    });
  } finally {
    await session.endSession();
  }

  const result = await getRecord(ctx, { objectSlug, recordId: String(recordId) });
  emitDomainEvent(ctx, recordEvent('created', object, result));
  return result;
}

/**
 * Un registro por id, hidratado.
 * @param {import('@/lib/auth/permissions').Ctx} ctx
 * @param {{ objectSlug: string, recordId: string }} args
 */
export async function getRecord(ctx, { objectSlug, recordId }) {
  assertTenant(ctx);
  const object = await resolveObject(ctx, objectSlug);
  await connectToDatabase();
  const record = await Record.findOne({
    _id: recordId,
    workspaceId: ctx.workspaceId,
    objectMetadataId: object.id,
    deletedAt: null,
  }).lean();
  if (!record) throw new NotFoundError('Registro no encontrado');
  const [hydrated] = await hydrateRecords(ctx, { records: [record], fields: object.fields });
  return hydrated;
}

/**
 * Lista registros con filtros, orden y paginación por cursor.
 * @param {import('@/lib/auth/permissions').Ctx} ctx
 * @param {{ objectSlug: string, filters?: Array, sorts?: Array, cursor?: string, limit?: number, includeDeleted?: boolean }} args
 */
export async function listRecords(
  ctx,
  { objectSlug, filters, sorts, cursor, limit, includeDeleted, fieldNames },
) {
  assertTenant(ctx);
  const object = await resolveObject(ctx, objectSlug);
  await connectToDatabase();

  const take = Math.min(Math.max(Number(limit) || 50, 1), MAX_LIMIT);
  const { match, sort, primaryField } = buildQuery({
    workspaceId: ctx.workspaceId,
    objectMetadataId: object.id,
    fields: object.fields,
    filters,
    sorts,
    cursor,
    includeDeleted,
  });

  // Proyección de columnas (opcional): si el cliente indica qué campos ve la
  // tabla, solo traemos esos `data.<campo>` + la raíz imprescindible, e hidratamos
  // solo las relaciones visibles. Menos payload y menos queries de hidratación.
  // El campo de orden viaja aunque no sea visible (lo necesita el cursor).
  let projection;
  let hydrateFields = object.fields;
  if (Array.isArray(fieldNames)) {
    const visible = new Set(fieldNames);
    hydrateFields = object.fields.filter((f) => visible.has(f.name));
    const dataPaths = new Set([...visible].map((n) => `data.${n}`));
    if (primaryField) dataPaths.add(`data.${primaryField.name}`);
    // Un campo FORMULA visible necesita los datos de los campos que referencia,
    // aunque esas columnas no estén a la vista.
    for (const f of hydrateFields) {
      if (f.type === 'FORMULA' && f.settings?.formula) {
        for (const dep of formulaDependencies(f.settings.formula)) dataPaths.add(`data.${dep}`);
      }
    }
    projection = ['position', 'createdAt', 'updatedAt', 'createdBy', ...dataPaths].join(' ');
  }

  const q = Record.find(match)
    .sort(sort)
    .limit(take + 1);
  if (projection) q.select(projection);
  const docs = await q.lean();

  const hasMore = docs.length > take;
  const page = hasMore ? docs.slice(0, take) : docs;
  const records = await hydrateRecords(ctx, {
    records: page,
    fields: hydrateFields,
    allFields: object.fields,
  });
  const nextCursor = hasMore ? buildNextCursor(page[page.length - 1], primaryField) : null;

  // Total de la vista, solo en la PRIMERA página: es lo que se enseña junto al
  // nombre de la vista, y contar en cada página sería pagar el `countDocuments`
  // una vez por scroll para un número que no cambia. Sin cursor no hay recorte
  // en el match, así que `match` ya es el filtro completo de la vista.
  const total = cursor ? undefined : await Record.countDocuments(match);

  return { records, nextCursor, hasMore, total };
}

/**
 * Actualiza (parcial) un registro. Registra el diff en el timeline.
 * @param {import('@/lib/auth/permissions').Ctx} ctx
 * @param {{ objectSlug: string, recordId: string, data: object }} args
 */
export async function updateRecord(ctx, { objectSlug, recordId, data }) {
  assertTenant(ctx);
  const object = await resolveObject(ctx, objectSlug);
  await connectToDatabase();

  const existing = await Record.findOne({
    _id: recordId,
    workspaceId: ctx.workspaceId,
    objectMetadataId: object.id,
    deletedAt: null,
  });
  if (!existing) throw new NotFoundError('Registro no encontrado');

  const patch = validateAndNormalize(object.fields, data ?? {}, { partial: true });
  if (Object.keys(patch).length === 0) throw new ValidationError('No hay cambios');

  const before = { ...existing.data };
  const after = { ...before, ...patch };
  const diff = diffData(before, after);

  const session = await mongoose.startSession();
  try {
    await session.withTransaction(async () => {
      existing.data = after;
      existing.searchText = buildSearchText(object.fields, after);
      existing.markModified('data');
      await existing.save({ session });
      await syncRecordRelations(
        ctx,
        { recordId: existing._id, data: after, fields: object.fields },
        { session },
      );
      if (Object.keys(diff).length) {
        await logEvent(
          ctx,
          { recordId: existing._id, objectMetadataId: object.id, event: 'updated', diff },
          { session },
        );
      }
    });
  } finally {
    await session.endSession();
  }

  const result = await getRecord(ctx, { objectSlug, recordId });
  emitDomainEvent(ctx, recordEvent('updated', object, result, { diff }));
  return result;
}

/**
 * Edición masiva: fija un mismo campo en varios registros. Reusa `updateRecord`
 * por registro, así hereda la validación contra la metadata, la sincronización
 * de relaciones/searchText, el timeline y el evento de dominio. Multi-tenant:
 * cada `updateRecord` filtra por workspace (ids de otro tenant → NotFoundError).
 * @param {import('@/lib/auth/permissions').Ctx} ctx
 * @param {{ objectSlug: string, recordIds: string[], fieldName: string, value: any }} args
 * @returns {Promise<{ updated: number }>}
 */
export async function bulkUpdateRecords(ctx, { objectSlug, recordIds, fieldName, value }) {
  assertTenant(ctx);
  if (!fieldName) throw new ValidationError('Falta el campo a editar');
  const ids = assertBulkSize(recordIds);
  let updated = 0;
  for (const recordId of ids) {
    await updateRecord(ctx, { objectSlug, recordId, data: { [fieldName]: value } });
    updated += 1;
  }
  return { updated };
}

/**
 * Borrado lógico (soft delete).
 * @param {import('@/lib/auth/permissions').Ctx} ctx
 * @param {{ objectSlug: string, recordId: string }} args
 */
export async function softDeleteRecord(ctx, { objectSlug, recordId }) {
  assertTenant(ctx);
  const object = await resolveObject(ctx, objectSlug);
  await connectToDatabase();
  const record = await Record.findOne({
    _id: recordId,
    workspaceId: ctx.workspaceId,
    objectMetadataId: object.id,
    deletedAt: null,
  });
  if (!record) throw new NotFoundError('Registro no encontrado');

  record.deletedAt = new Date();
  await record.save();
  await logEvent(ctx, { recordId: record._id, objectMetadataId: object.id, event: 'deleted' });
  emitDomainEvent(ctx, recordEvent('deleted', object, { id: String(record._id) }));
}

/**
 * Restaura un registro borrado.
 * @param {import('@/lib/auth/permissions').Ctx} ctx
 * @param {{ objectSlug: string, recordId: string }} args
 */
export async function restoreRecord(ctx, { objectSlug, recordId }) {
  assertTenant(ctx);
  const object = await resolveObject(ctx, objectSlug);
  await connectToDatabase();
  const record = await Record.findOne({
    _id: recordId,
    workspaceId: ctx.workspaceId,
    objectMetadataId: object.id,
    deletedAt: { $ne: null },
  });
  if (!record) throw new NotFoundError('Registro no encontrado');

  record.deletedAt = null;
  await record.save();
  await logEvent(ctx, { recordId: record._id, objectMetadataId: object.id, event: 'restored' });
}

/**
 * Lista una columna del kanban (registros con un valor del campo de agrupación),
 * ordenada por `position` con paginación por cursor (carga perezosa por columna).
 * @param {import('@/lib/auth/permissions').Ctx} ctx
 * @param {{ objectSlug: string, groupFieldName: string, value: any, cursor?: string, limit?: number }} args
 */
export async function listBoardColumn(
  ctx,
  { objectSlug, groupFieldName, value, cursor, limit = 40 },
) {
  assertTenant(ctx);
  const object = await resolveObject(ctx, objectSlug);
  await connectToDatabase();

  const path = `data.${groupFieldName}`;
  const and = [{ workspaceId: ctx.workspaceId, objectMetadataId: object.id, deletedAt: null }];
  if (value === null || value === undefined) {
    and.push({ $or: [{ [path]: null }, { [path]: { $exists: false } }] });
  } else {
    and.push({ [path]: value });
  }

  const decoded = decodeCursor(cursor);
  if (decoded) {
    const id = new mongoose.Types.ObjectId(decoded.id);
    and.push({
      $or: [
        { position: { $gt: decoded.sortValue } },
        { position: decoded.sortValue, _id: { $gt: id } },
      ],
    });
  }

  const take = Math.min(Math.max(Number(limit) || 40, 1), MAX_LIMIT);
  const docs = await Record.find({ $and: and })
    .sort({ position: 1, _id: 1 })
    .limit(take + 1)
    .lean();

  const hasMore = docs.length > take;
  const page = hasMore ? docs.slice(0, take) : docs;
  const records = await hydrateRecords(ctx, { records: page, fields: object.fields });
  const last = page[page.length - 1];
  const nextCursor = hasMore
    ? encodeCursor({ sortValue: last.position ?? null, id: String(last._id) })
    : null;

  return { records, nextCursor, hasMore };
}

/**
 * Mueve un registro en el kanban: cambia el grupo (SELECT) y/o su `position`.
 * Registra el cambio de grupo en el timeline.
 * @param {import('@/lib/auth/permissions').Ctx} ctx
 * @param {{ objectSlug: string, recordId: string, position?: string, patch?: object }} args
 */
export async function moveRecord(ctx, { objectSlug, recordId, position, patch = {} }) {
  assertTenant(ctx);
  const object = await resolveObject(ctx, objectSlug);
  await connectToDatabase();

  const existing = await Record.findOne({
    _id: recordId,
    workspaceId: ctx.workspaceId,
    objectMetadataId: object.id,
    deletedAt: null,
  });
  if (!existing) throw new NotFoundError('Registro no encontrado');

  const norm = validateAndNormalize(object.fields, patch, { partial: true });
  const before = { ...existing.data };
  const after = { ...before, ...norm };
  const diff = diffData(before, after);

  const session = await mongoose.startSession();
  try {
    await session.withTransaction(async () => {
      existing.data = after;
      existing.searchText = buildSearchText(object.fields, after);
      if (position !== undefined) existing.position = position;
      existing.markModified('data');
      await existing.save({ session });
      if (Object.keys(norm).length) {
        await syncRecordRelations(
          ctx,
          { recordId: existing._id, data: after, fields: object.fields },
          { session },
        );
      }
      if (Object.keys(diff).length) {
        await logEvent(
          ctx,
          { recordId: existing._id, objectMetadataId: object.id, event: 'updated', diff },
          { session },
        );
      }
    });
  } finally {
    await session.endSession();
  }

  return getRecord(ctx, { objectSlug, recordId });
}

/**
 * Reasigna en bloque la clave de orden manual (`position`) de una lista de
 * registros para que su orden sea exactamente `orderedIds`. Se usa al arrastrar
 * una fila mientras hay un orden de columna activo: la vista pasa a orden manual
 * «horneando» el orden visible actual. Una sola escritura (`bulkWrite`).
 * @param {import('@/lib/auth/permissions').Ctx} ctx
 * @param {{ objectSlug: string, orderedIds: string[] }} args
 */
export async function reorderRecords(ctx, { objectSlug, orderedIds }) {
  assertTenant(ctx);
  const object = await resolveObject(ctx, objectSlug);
  await connectToDatabase();

  const ids = (Array.isArray(orderedIds) ? orderedIds : []).filter((id) =>
    mongoose.Types.ObjectId.isValid(id),
  );
  if (ids.length === 0) return { count: 0 };

  const keys = generateNKeysBetween(null, null, ids.length);
  const ops = ids.map((id, i) => ({
    updateOne: {
      filter: {
        _id: id,
        workspaceId: ctx.workspaceId,
        objectMetadataId: object.id,
        deletedAt: null,
      },
      update: { $set: { position: keys[i] } },
    },
  }));
  const res = await Record.bulkWrite(ops);
  return { count: res.modifiedCount ?? ids.length };
}

/** Ruta Mongo del valor numérico de un campo sumable. */
function sumPath(field) {
  if (!field) return null;
  if (field.type === 'CURRENCY') return `data.${field.name}.amount`;
  if (field.type === 'NUMBER' || field.type === 'PERCENT' || field.type === 'RATING') {
    return `data.${field.name}`;
  }
  return null;
}

/**
 * Agregados por columna kanban: conteo y suma de un campo numérico por valor del
 * campo de agrupación. Exacto (agregación en servidor), independiente de la carga
 * perezosa del cliente.
 * @param {import('@/lib/auth/permissions').Ctx} ctx
 * @param {{ objectSlug: string, groupFieldName: string, sumFieldName?: string }} args
 * @returns {Promise<Array<{ value: any, count: number, sum: number }>>}
 */
export async function columnAggregates(ctx, { objectSlug, groupFieldName, sumFieldName }) {
  assertTenant(ctx);
  const object = await resolveObject(ctx, objectSlug);
  await connectToDatabase();

  const sumField = sumFieldName ? object.fields.find((f) => f.name === sumFieldName) : null;
  const path = sumPath(sumField);

  const rows = await Record.aggregate([
    {
      $match: {
        workspaceId: new mongoose.Types.ObjectId(String(ctx.workspaceId)),
        objectMetadataId: new mongoose.Types.ObjectId(String(object.id)),
        deletedAt: null,
      },
    },
    {
      $group: {
        _id: `$data.${groupFieldName}`,
        count: { $sum: 1 },
        sum: path ? { $sum: `$${path}` } : { $sum: 0 },
      },
    },
  ]);

  return rows.map((r) => ({ value: r._id ?? null, count: r.count, sum: r.sum ?? 0 }));
}

/**
 * Busca registros de un objeto por su searchText (para el picker de vinculación).
 * @param {import('@/lib/auth/permissions').Ctx} ctx
 * @param {{ objectSlug: string, q?: string, limit?: number }} args
 * @returns {Promise<Array<{ id: string, label: string }>>}
 */
export async function searchRecords(ctx, { objectSlug, q = '', limit = 20 }) {
  assertTenant(ctx);
  const object = await resolveObject(ctx, objectSlug);
  await connectToDatabase();

  const idField = object.fields.find((f) => f.id === object.labelIdentifierFieldId);
  const match = { workspaceId: ctx.workspaceId, objectMetadataId: object.id, deletedAt: null };
  if (q) match.searchText = new RegExp(escapeRegex(q), 'i');

  const records = await Record.find(match).limit(limit).lean();
  return records.map((r) => {
    const value = idField ? r.data?.[idField.name] : null;
    const label = idField ? getFieldType(idField.type).toSearchText(value, idField) : '';
    return { id: String(r._id), label: label || '(sin nombre)' };
  });
}

/**
 * Papelera: registros borrados (soft) agrupados por objeto.
 * @param {import('@/lib/auth/permissions').Ctx} ctx
 */
export async function listAllTrash(ctx) {
  assertTenant(ctx);
  await connectToDatabase();
  const objects = await ObjectMetadata.find({
    workspaceId: ctx.workspaceId,
    deletedAt: null,
    isActive: true,
  })
    .sort({ position: 1 })
    .lean();

  const groups = [];
  for (const object of objects) {
    const idField = object.labelIdentifierFieldId
      ? await FieldMetadata.findById(object.labelIdentifierFieldId).lean()
      : null;
    const records = await Record.find({
      workspaceId: ctx.workspaceId,
      objectMetadataId: object._id,
      deletedAt: { $ne: null },
    })
      .sort({ deletedAt: -1 })
      .limit(50)
      .lean();
    if (records.length === 0) continue;
    groups.push({
      object: {
        id: String(object._id),
        slug: object.slug,
        labelPlural: object.labelPlural,
        icon: object.icon,
      },
      records: records.map((r) => {
        const value = idField ? r.data?.[idField.name] : null;
        const label = idField ? getFieldType(idField.type).toSearchText(value, idField) : '';
        return { id: String(r._id), label: label || '(sin nombre)' };
      }),
    });
  }
  return groups;
}

/** Borra definitivamente un registro (y sus aristas de relación). */
export async function hardDeleteRecord(ctx, { objectSlug, recordId }) {
  assertTenant(ctx);
  const object = await resolveObject(ctx, objectSlug);
  await connectToDatabase();
  const record = await Record.findOne({
    _id: recordId,
    workspaceId: ctx.workspaceId,
    objectMetadataId: object.id,
  });
  if (!record) throw new NotFoundError('Registro no encontrado');
  await removeRecordRelations(ctx, record._id);
  await record.deleteOne();
}

/**
 * Exporta todos los registros que cumplen los filtros (respetando el orden),
 * hasta un tope. Devuelve filas hidratadas para serializar a CSV.
 * @param {import('@/lib/auth/permissions').Ctx} ctx
 */
export async function exportRecords(ctx, { objectSlug, filters, sorts, cap = 10000 }) {
  assertTenant(ctx);
  const object = await resolveObject(ctx, objectSlug);
  const all = [];
  let cursor;
  do {
    const page = await listRecords(ctx, { objectSlug, filters, sorts, cursor, limit: 200 });
    all.push(...page.records);
    cursor = page.nextCursor;
  } while (cursor && all.length < cap);
  return { fields: object.fields, records: all.slice(0, cap) };
}

/** Coacciona un valor de texto (CSV) al tipo del campo. */
function coerceValue(field, raw) {
  const v = String(raw ?? '').trim();
  if (v === '') return null;
  switch (field.type) {
    case 'NUMBER':
    case 'PERCENT':
    case 'RATING':
      return Number(v);
    case 'CURRENCY':
      return { amount: Number(v), currencyCode: 'EUR' };
    case 'BOOLEAN':
      return /^(true|1|s[ií]|yes)$/i.test(v);
    case 'MULTI_SELECT':
    case 'EMAILS':
    case 'PHONES':
    case 'ARRAY':
      return v
        .split(/[;,]/)
        .map((s) => s.trim())
        .filter(Boolean);
    case 'LINKS':
      return v
        .split(/[;,]/)
        .map((s) => ({ url: s.trim(), label: '' }))
        .filter((l) => l.url);
    default:
      return v; // TEXT, SELECT, DATE, DATE_TIME, UUID…
  }
}

/**
 * Importa filas (objeto { fieldName: rawString }) creando registros. Valida cada
 * fila; devuelve un resumen con los errores por fila.
 * @param {import('@/lib/auth/permissions').Ctx} ctx
 * @param {{ objectSlug: string, rows: Array<Record<string, any>> }} args
 */
export async function importRecords(ctx, { objectSlug, rows }) {
  assertTenant(ctx);
  const all = Array.isArray(rows) ? rows : [];
  if (all.length > MAX_IMPORT_ROWS) {
    throw new ValidationError(
      `Importa como mucho ${MAX_IMPORT_ROWS} filas por archivo. Divide el CSV y hazlo en varias tandas.`,
    );
  }
  const object = await resolveObject(ctx, objectSlug);
  const byName = new Map(object.fields.map((f) => [f.name, f]));

  let created = 0;
  const errors = [];
  for (let i = 0; i < all.length; i += 1) {
    const raw = all[i];
    const data = {};
    for (const [name, value] of Object.entries(raw)) {
      const field = byName.get(name);
      if (!field) continue;
      const coerced = coerceValue(field, value);
      if (coerced !== null) data[name] = coerced;
    }
    try {
      await createRecord(ctx, { objectSlug, data, source: 'IMPORT' });
      created += 1;
    } catch (err) {
      errors.push({ row: i + 1, message: err?.message ?? 'Error' });
    }
  }
  return { created, failed: errors.length, errors };
}

export { removeRecordRelations };
