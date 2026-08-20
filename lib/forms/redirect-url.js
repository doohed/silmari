/**
 * Validación de la URL de redirección de un formulario público.
 *
 * Es su propio módulo, puro y sin dependencias, porque hace falta **en los dos
 * lados**: el servicio la valida al guardar y el renderizador la vuelve a
 * comprobar antes de navegar. Con una sola de las dos comprobaciones no basta:
 * la del servidor no protege a los formularios ya guardados, y la del cliente
 * sola se salta llamando a la API.
 *
 * Lo que se cierra: `javascript:alert(1)` en este campo se ejecuta **en nuestro
 * origen**, en una página pública y sin sesión, contra cualquiera que envíe el
 * formulario. La CSP no lo frena, porque una navegación a `javascript:` no la
 * cubre `script-src`.
 */

/** Esquemas admitidos. Todo lo demás (javascript:, data:, vbscript:…) fuera. */
const ALLOWED_PROTOCOLS = new Set(['http:', 'https:']);

/**
 * ¿Se puede navegar a esta URL sin riesgo?
 * @param {unknown} raw
 * @returns {boolean}
 */
export function isSafeRedirectUrl(raw) {
  if (typeof raw !== 'string' || raw.trim() === '') return false;
  try {
    return ALLOWED_PROTOCOLS.has(new URL(raw.trim()).protocol);
  } catch {
    return false; // no es una URL absoluta
  }
}

/**
 * Normaliza el valor que llega del formulario de configuración: cadena vacía y
 * espacios → `null` (el campo es opcional).
 * @param {unknown} raw
 * @returns {string | null}
 */
export function normalizeRedirectUrl(raw) {
  const trimmed = typeof raw === 'string' ? raw.trim() : '';
  return trimmed === '' ? null : trimmed;
}
