/**
 * Qué campos pueden usarse como clave de duplicados en la entrada de leads.
 * Módulo puro (sin BD) para poder importarlo también desde el cliente.
 */

/**
 * Tipos cuyo valor es un escalar o un array de escalares, y por tanto se pueden
 * comparar de forma exacta. Se dejan fuera los compuestos (FULL_NAME, ADDRESS,
 * LINKS…), los de sistema y los que no identifican a nadie (BOOLEAN, RATING…).
 */
export const DEDUPE_TYPES = new Set(['TEXT', 'UUID', 'NUMBER', 'EMAILS', 'PHONES', 'SELECT']);

/**
 * ¿Sirve este campo como clave de duplicados?
 * @param {{ type: string, isSystem?: boolean, isActive?: boolean }} field
 * @returns {boolean}
 */
export function canBeDedupeKey(field) {
  return Boolean(field) && !field.isSystem && DEDUPE_TYPES.has(field.type);
}

/** Normaliza un valor para compararlo de forma exacta pero tolerante. */
function norm(value) {
  return String(value ?? '')
    .trim()
    .toLowerCase();
}

/**
 * ¿El valor guardado en un registro corresponde a la clave buscada? Los tipos
 * de array (EMAILS, PHONES) coinciden si alguno de sus elementos es igual.
 * @param {any} recordValue Valor almacenado en `data.<campo>`
 * @param {any} needle Valor entrante
 * @returns {boolean}
 */
export function matchesDedupeKey(recordValue, needle) {
  if (needle === null || needle === undefined || needle === '') return false;
  if (Array.isArray(recordValue)) return recordValue.some((v) => norm(v) === norm(needle));
  return norm(recordValue) === norm(needle);
}
