/**
 * Evaluador puro de ROLLUP: agrega una lista de valores numéricos (los del campo
 * elegido en los registros relacionados) según la operación. Sin BD ni metadata,
 * para poder testearlo aislado. La recogida de los valores (recorrer la relación
 * inversa) la hace `lib/records/hydrate.js`.
 */

/** Operaciones de agregación admitidas. */
export const ROLLUP_OPERATIONS = ['count', 'sum', 'avg', 'min', 'max'];

/**
 * @param {string} operation  una de ROLLUP_OPERATIONS
 * @param {number[]} values   valores numéricos de los registros relacionados
 *   (para `count` solo importa cuántos hay)
 * @returns {number}
 */
export function aggregateRollup(operation, values) {
  const list = values ?? [];
  if (operation === 'count') return list.length;
  const nums = list.map(Number).filter(Number.isFinite);
  if (nums.length === 0) return 0;
  switch (operation) {
    case 'sum':
      return nums.reduce((a, b) => a + b, 0);
    case 'avg':
      return nums.reduce((a, b) => a + b, 0) / nums.length;
    case 'min':
      return Math.min(...nums);
    case 'max':
      return Math.max(...nums);
    default:
      return 0;
  }
}
