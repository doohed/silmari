import mongoose from 'mongoose';
import { getFieldType } from '@/lib/field-types';
import { decodeCursor, encodeCursor } from '@/lib/utils/cursor';
import { fieldPath, valueAtPath } from '@/lib/records/field-path';
import { ValidationError } from '@/lib/errors/domain-errors';

/**
 * Ruta por la que se ordena y pagina un campo. Algunos tipos ordenan por un
 * subcampo del valor (p. ej. ACTOR ordena por `.source`).
 * @param {object} field FieldMetadata DTO
 * @returns {string}
 */
function sortPathFor(field) {
  const base = fieldPath(field);
  const def = getFieldType(field.type);
  return def.sortPath ? def.sortPath(base) : base;
}

/**
 * Construye el filtro Mongo, el orden y el recorte por cursor para listar
 * registros. Devuelve `{ match, sort, primaryField }` para usar con
 * `Record.find(match).sort(sort).limit(limit + 1)`.
 *
 * @param {object} params
 * @param {any} params.workspaceId
 * @param {any} params.objectMetadataId
 * @param {Array<object>} params.fields  FieldMetadata DTOs (para resolver tipos)
 * @param {Array<{ fieldName: string, operator: string, value: any }>} [params.filters]
 * @param {Array<{ fieldName: string, direction: 'asc'|'desc' }>} [params.sorts]
 * @param {string} [params.cursor]
 * @param {boolean} [params.includeDeleted]
 */
export function buildQuery({
  workspaceId,
  objectMetadataId,
  fields,
  filters = [],
  sorts = [],
  cursor,
  includeDeleted = false,
}) {
  const byName = new Map(fields.map((f) => [f.name, f]));
  const and = [{ workspaceId, objectMetadataId }];
  if (!includeDeleted) and.push({ deletedAt: null });

  // Filtros → fragmentos de match vía el registry de tipos.
  for (const filter of filters) {
    const field = byName.get(filter.fieldName);
    if (!field) throw new ValidationError(`Campo de filtro desconocido: ${filter.fieldName}`);
    const def = getFieldType(field.type);
    if (!def.filterOperators.includes(filter.operator)) {
      throw new ValidationError(
        `Operador "${filter.operator}" no válido para el campo "${filter.fieldName}"`,
      );
    }
    and.push(def.buildFilter(field.name, filter.operator, filter.value, field));
  }

  // Orden: campo primario opcional + desempate por _id.
  const primarySort = sorts[0];
  const primaryField = primarySort ? byName.get(primarySort.fieldName) : null;
  if (primarySort && !primaryField) {
    throw new ValidationError(`Campo de orden desconocido: ${primarySort.fieldName}`);
  }
  const dir = primarySort?.direction === 'desc' ? -1 : 1;

  let sort;
  if (primaryField) {
    sort = { [sortPathFor(primaryField)]: dir, _id: dir };
  } else {
    // Sin orden de columna: orden manual por `position` (fractional indexing),
    // con `_id` de desempate. Es lo que permite reordenar arrastrando filas.
    sort = { position: 1, _id: 1 };
  }

  // Recorte por cursor.
  const decoded = decodeCursor(cursor);
  if (decoded) {
    const id = new mongoose.Types.ObjectId(decoded.id);
    if (primaryField) {
      const path = sortPathFor(primaryField);
      const sv = getFieldType(primaryField.type).normalize(decoded.sortValue, primaryField);
      const cmp = dir === 1 ? '$gt' : '$lt';
      and.push({
        $or: [{ [path]: { [cmp]: sv } }, { [path]: sv, _id: { [cmp]: id } }],
      });
    } else {
      const sv = decoded.sortValue ?? null; // clave `position` del último registro
      and.push({
        $or: [{ position: { $gt: sv } }, { position: sv, _id: { $gt: id } }],
      });
    }
  }

  return { match: { $and: and }, sort, primaryField: primaryField ?? null };
}

/**
 * Cursor del siguiente registro a partir del último devuelto.
 * @param {object} lastRecord documento Record (lean)
 * @param {object|null} primaryField campo de orden primario (o null)
 */
export function buildNextCursor(lastRecord, primaryField) {
  const sortValue = primaryField
    ? (valueAtPath(lastRecord, sortPathFor(primaryField)) ?? null)
    : (lastRecord.position ?? null);
  return encodeCursor({ sortValue, id: String(lastRecord._id) });
}
