/**
 * Cálculo puro de totales de líneas (cotizaciones/pedidos). Sin BD ni moneda: la
 * moneda de visualización la pone la UI (la del workspace). Cada línea es
 * `{ description, quantity, unitPrice, discount }` (discount es un % 0–100).
 */

/** Redondeo a 2 decimales evitando la deriva binaria (…* 100 / 100). */
function round2(n) {
  return Math.round((n + Number.EPSILON) * 100) / 100;
}

const num = (v) => {
  const n = Number(v);
  return Number.isFinite(n) ? n : 0;
};

/** Subtotal de una línea (antes de descuento): cantidad × precio. */
export function lineSubtotal(line) {
  return round2(num(line?.quantity) * num(line?.unitPrice));
}

/** Total de una línea aplicando su descuento (%). */
export function lineTotal(line) {
  const disc = Math.min(Math.max(num(line?.discount), 0), 100);
  return round2(lineSubtotal(line) * (1 - disc / 100));
}

/**
 * Totales de un conjunto de líneas.
 * @param {Array<object>} lines
 * @returns {{ count: number, subtotal: number, discountTotal: number, total: number }}
 */
export function quoteTotals(lines) {
  const list = Array.isArray(lines) ? lines : [];
  let subtotal = 0;
  let total = 0;
  for (const l of list) {
    subtotal += lineSubtotal(l);
    total += lineTotal(l);
  }
  subtotal = round2(subtotal);
  total = round2(total);
  return { count: list.length, subtotal, discountTotal: round2(subtotal - total), total };
}
