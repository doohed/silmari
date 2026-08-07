/** Formateadores para la UI (es-ES). */

const numberFmt = new Intl.NumberFormat('es-ES');

/** @param {number|null|undefined} n */
export function formatNumber(n) {
  if (n === null || n === undefined || Number.isNaN(n)) return '';
  return numberFmt.format(n);
}

const currencyCache = new Map();

/**
 * Formatea un importe con su moneda (símbolo + separadores de miles).
 * @param {number} amount
 * @param {string} [currencyCode]
 */
export function formatCurrency(amount, currencyCode = 'EUR') {
  if (amount === null || amount === undefined || Number.isNaN(amount)) return '';
  let fmt = currencyCache.get(currencyCode);
  if (!fmt) {
    try {
      fmt = new Intl.NumberFormat('es-ES', {
        style: 'currency',
        currency: currencyCode,
        maximumFractionDigits: 0,
      });
    } catch {
      fmt = numberFmt;
    }
    currencyCache.set(currencyCode, fmt);
  }
  return fmt.format(amount);
}
