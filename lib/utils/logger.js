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

/**
 * Enmascara una dirección de correo para el log.
 *
 * Los eventos de seguridad hay que poder seguirlos, pero un log lleno de
 * direcciones en claro es un fichero con datos personales que el RGPD obliga a
 * justificar y a custodiar. Se deja lo justo para reconocer la cuenta al
 * leerlo (dos primeras letras y el dominio) y para agrupar por dominio, que es
 * lo que interesa cuando alguien está barriendo altas.
 *
 * @param {unknown} email
 * @returns {string}
 */
export function maskEmail(email) {
  const value = String(email ?? '').trim();
  const at = value.lastIndexOf('@');
  if (at <= 0) return value ? '***' : '';
  const local = value.slice(0, at);
  const domain = value.slice(at);
  return `${local.slice(0, 2)}***${domain}`;
}

/**
 * Registra un evento de seguridad con un prefijo **grepeable**.
 *
 * Existe porque hoy no queda rastro distinguible de un login fallido, de un
 * freno disparado ni de un alta de credencial: sin eso no hay forma de
 * detectar un ataque en curso ni de reconstruir qué pasó después. Encaja con el
 * criterio del logger: esto se lee a mano (`docker compose logs | grep '[sec]'`),
 * no hay agregador.
 *
 * El `meta.email` se enmascara solo; no metas contraseñas, tokens ni cookies.
 *
 * @param {string} event Identificador estable, p. ej. 'login.failed'.
 * @param {Record<string, unknown>} [meta]
 */
export function logSecurityEvent(event, meta = {}) {
  const safe = { ...meta };
  if ('email' in safe) safe.email = maskEmail(safe.email);
  logger.info('[sec]', event, safe);
}
