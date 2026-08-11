/**
 * Renderizado de plantillas de mensaje. Puro (sin BD): sustituye variables
 * `{{campo}}` por su valor. Compartido por cliente (vista previa) y servidor
 * (composición real de email/WhatsApp).
 */

const VAR_RE = /\{\{\s*([\w.]+)\s*\}\}/g;

/**
 * Nombres de variable `{{x}}` presentes en un texto, sin duplicados y en orden
 * de aparición.
 * @param {string} text
 * @returns {string[]}
 */
export function extractVariables(text) {
  const out = [];
  const seen = new Set();
  for (const m of String(text ?? '').matchAll(VAR_RE)) {
    if (!seen.has(m[1])) {
      seen.add(m[1]);
      out.push(m[1]);
    }
  }
  return out;
}

/**
 * Sustituye cada `{{var}}` por `variables[var]`. Las variables ausentes o nulas
 * se reemplazan por cadena vacía (nunca deja el literal `{{...}}` en el mensaje).
 * @param {string} text
 * @param {Record<string, any>} variables
 * @returns {string}
 */
export function renderTemplate(text, variables) {
  return String(text ?? '').replace(VAR_RE, (_, key) => {
    const v = variables?.[key];
    return v == null ? '' : String(v);
  });
}
