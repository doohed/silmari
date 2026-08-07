/**
 * Convierte un texto en un slug URL-safe (minúsculas, sin acentos, guiones).
 * @param {string} input
 * @returns {string}
 */
export function slugify(input) {
  return String(input)
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '') // quita acentos (diacríticos combinados)
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 60);
}
