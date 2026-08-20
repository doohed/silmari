/**
 * Cursor opaco (base64url) para paginación estable sobre `(sortValue, _id)`.
 */

/**
 * @param {{ sortValue: any, id: string }} payload
 * @returns {string}
 */
export function encodeCursor(payload) {
  return Buffer.from(JSON.stringify(payload)).toString('base64url');
}

/**
 * Decodifica un cursor. Devuelve `null` ante cualquier cursor que no tenga la
 * forma esperada, que es lo mismo que hace ante uno corrupto: se empieza la
 * página desde el principio.
 *
 * El `sortValue` tiene que ser **escalar**. El cursor lo manda el cliente y su
 * valor acaba dentro del match de Mongo (`{ position: sortValue }`), así que un
 * objeto se interpretaría como operador (`{$ne}`, `{$regex}`…) y convertiría la
 * paginación en un hueco por donde escribir la consulta.
 *
 * @param {string | null | undefined} cursor
 * @returns {{ sortValue: any, id: string } | null}
 */
export function decodeCursor(cursor) {
  if (!cursor) return null;
  try {
    const parsed = JSON.parse(Buffer.from(cursor, 'base64url').toString('utf8'));
    if (typeof parsed?.id !== 'string') return null;
    const sortValue = parsed.sortValue;
    if (sortValue !== null && sortValue !== undefined && typeof sortValue === 'object') return null;
    return parsed;
  } catch {
    return null;
  }
}
