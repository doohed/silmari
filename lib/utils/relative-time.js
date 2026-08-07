/**
 * Formatea una fecha como tiempo relativo en español ("hace 3 h", "en 2 días").
 * Pensado para cliente y servidor; acepta `Date`, número o cadena ISO.
 */

const rtf = new Intl.RelativeTimeFormat('es-ES', { numeric: 'auto' });

/** @type {Array<[Intl.RelativeTimeFormatUnit, number]>} */
const UNITS = [
  ['year', 1000 * 60 * 60 * 24 * 365],
  ['month', 1000 * 60 * 60 * 24 * 30],
  ['day', 1000 * 60 * 60 * 24],
  ['hour', 1000 * 60 * 60],
  ['minute', 1000 * 60],
];

/**
 * @param {Date|string|number|null|undefined} value
 * @param {Date} [now]
 * @returns {string} p. ej. "hace 20 horas". Cadena vacía si no hay fecha válida.
 */
export function formatRelative(value, now = new Date()) {
  if (!value) return '';
  const d = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(d.getTime())) return '';
  const diff = d.getTime() - now.getTime();
  const abs = Math.abs(diff);
  if (abs < 45 * 1000) return 'hace un momento';
  for (const [unit, ms] of UNITS) {
    if (abs >= ms) return rtf.format(Math.round(diff / ms), unit);
  }
  return 'hace un momento';
}
