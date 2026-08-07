/**
 * Campos de sistema cuyo valor NO vive en `records.data` sino en la **raíz** del
 * documento (ver `models/Record.js`). La metadata los expone como campos
 * normales para que la UI los pinte como una columna más, pero su ruta de
 * almacenamiento, consulta y ordenación es distinta.
 *
 * Solo el servidor los escribe: son de lectura para cliente y API pública.
 */

/** Nombres de campo que se resuelven contra la raíz del documento. */
export const ROOT_FIELD_NAMES = new Set(['createdBy']);

/**
 * ¿El valor de este campo vive en la raíz del documento (y no en `data`)?
 * @param {{ name?: string, isSystem?: boolean }} field FieldMetadata DTO
 * @returns {boolean}
 */
export function isRootField(field) {
  return Boolean(field?.isSystem) && ROOT_FIELD_NAMES.has(field?.name);
}

/**
 * Ruta del valor dentro del documento de registro, para `match`/`sort` de Mongo.
 * @param {{ name: string, isSystem?: boolean }} field
 * @returns {string} `createdBy` o `data.<name>`
 */
export function fieldPath(field) {
  return isRootField(field) ? field.name : `data.${field.name}`;
}

/**
 * Lee el valor de un campo de un registro. Sirve tanto para documentos `lean`
 * como para los DTO hidratados (`hydrateRecords` mantiene los campos de sistema
 * en la raíz del DTO).
 * @param {object} record
 * @param {{ name: string, isSystem?: boolean }} field
 * @returns {any}
 */
export function readFieldValue(record, field) {
  if (!record) return undefined;
  return isRootField(field) ? record[field.name] : record.data?.[field.name];
}

/**
 * Lee un valor anidado por ruta con puntos (`createdBy.source`).
 * @param {object} doc
 * @param {string} path
 * @returns {any}
 */
export function valueAtPath(doc, path) {
  return path.split('.').reduce((acc, key) => (acc == null ? undefined : acc[key]), doc);
}
