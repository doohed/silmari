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
 * @param {string | null | undefined} cursor
 * @returns {{ sortValue: any, id: string } | null}
 */
export function decodeCursor(cursor) {
  if (!cursor) return null;
  try {
    const parsed = JSON.parse(Buffer.from(cursor, 'base64url').toString('utf8'));
    if (typeof parsed?.id !== 'string') return null;
    return parsed;
  } catch {
    return null;
  }
}
