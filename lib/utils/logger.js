/**
 * Logger mínimo con niveles. Evita `console.log` disperso por el código.
 *
 * Pensado para **leerse a mano** (`docker compose logs`), no para un agregador:
 *
 * - **Una línea por evento.** El contexto se serializa compacto en vez de dejar
 *   que Node lo imprima en varias líneas, porque un evento partido en cinco
 *   líneas no se puede `grep`ear.
 * - **Con marca de tiempo propia.** `docker compose logs -t` añade la suya, pero
 *   en un fichero rotado o redirigido esa marca no está.
 * - **Los errores conservan el stack**, que sí interesa multilínea.
 *
 * Nivel con `LOG_LEVEL` (debug|info|warn|error). Por defecto `debug` en
 * desarrollo e `info` en producción: con `warn` no se vería ni un alta, ni un
 * correo enviado, ni un cobro procesado, que es justo lo que se busca cuando se
 * entra a mirar por qué algo no ha funcionado.
 */

const LEVELS = { debug: 10, info: 20, warn: 30, error: 40 };

const configuredLevel =
  process.env.LOG_LEVEL || (process.env.NODE_ENV === 'production' ? 'info' : 'debug');
const threshold = LEVELS[configuredLevel] ?? LEVELS.debug;

/**
 * Convierte un argumento en algo que quepa en una línea. Los `Error` se dejan
 * pasar tal cual para que Node imprima su stack.
 * @param {unknown} arg
 */
function format(arg) {
  if (arg instanceof Error) return arg;
  if (typeof arg === 'string') return arg;
  try {
    // Sin indentación: un objeto de contexto debe caber en la misma línea que
    // su mensaje.
    return JSON.stringify(arg);
  } catch {
    return String(arg);
  }
}

/**
 * @param {'debug'|'info'|'warn'|'error'} level
 * @param {unknown[]} args
 */
function emit(level, args) {
  if (LEVELS[level] < threshold) return;
  const prefix = `${new Date().toISOString()} [${level}]`;
  const fn = level === 'error' ? console.error : level === 'warn' ? console.warn : console.log;
  fn(prefix, ...args.map(format));
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
