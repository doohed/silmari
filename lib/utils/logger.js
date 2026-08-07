/**
 * Logger mínimo con niveles. Evita `console.log` disperso por el código.
 * El nivel se controla con la env var LOG_LEVEL (debug|info|warn|error).
 * Por defecto: debug en desarrollo, warn en producción.
 */

const LEVELS = { debug: 10, info: 20, warn: 30, error: 40 };

const configuredLevel =
  process.env.LOG_LEVEL || (process.env.NODE_ENV === 'production' ? 'warn' : 'debug');
const threshold = LEVELS[configuredLevel] ?? LEVELS.debug;

/**
 * @param {'debug'|'info'|'warn'|'error'} level
 * @param {unknown[]} args
 */
function emit(level, args) {
  if (LEVELS[level] < threshold) return;
  const prefix = `[${level}]`;
  const fn = level === 'error' ? console.error : level === 'warn' ? console.warn : console.log;
  fn(prefix, ...args);
}

export const logger = {
  /** @param {...unknown} args */
  debug: (...args) => emit('debug', args),
  /** @param {...unknown} args */
  info: (...args) => emit('info', args),
  /** @param {...unknown} args */
  warn: (...args) => emit('warn', args),
  /** @param {...unknown} args */
  error: (...args) => emit('error', args),
};
