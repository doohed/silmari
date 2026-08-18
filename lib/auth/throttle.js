import 'server-only';
import { headers } from 'next/headers';
import { consumeRateLimit } from '@/lib/http/rate-limit';
import { TooManyRequestsError } from '@/lib/errors/domain-errors';

/**
 * Freno de los flujos de autenticación (login, alta, contraseña olvidada,
 * aceptar invitación), que son server actions y por tanto no pasan por
 * `lib/http/api-context.js`.
 *
 * Se limita por **dos claves a la vez**:
 * - por **email**, para que no se pueda machacar una cuenta concreta desde
 *   muchas IPs;
 * - por **IP**, para que una sola máquina no pueda barrer muchas cuentas.
 *
 * Limitación conocida: el contador es en memoria por instancia
 * (`lib/http/rate-limit.js`). Con una sola instancia es suficiente; el día que
 * haya varias, hay que moverlo a un almacén compartido.
 */

/** Ventana y cupo por flujo. Los de contraseña son los más estrictos. */
const RULES = {
  login: { email: 5, ip: 20 },
  signup: { email: 3, ip: 10 },
  forgotPassword: { email: 3, ip: 10 },
  resetPassword: { email: 5, ip: 20 },
  acceptInvite: { email: 10, ip: 30 },
};

const WINDOW_MS = 15 * 60 * 1000; // 15 minutos

/**
 * IP del cliente detrás del reverse proxy. Se queda con la primera de
 * `x-forwarded-for` (la del cliente; el resto son proxies).
 *
 * OJO: esta cabecera la puede falsificar el cliente si tu proxy no la
 * sobrescribe. En nginx debe ser `proxy_set_header X-Forwarded-For $remote_addr`,
 * NO `$proxy_add_x_forwarded_for`, que la añade en vez de reemplazarla y dejaría
 * pasar la que mandó el cliente (ver docs/runbook.md).
 *
 * @returns {Promise<string>}
 */
export async function clientIp() {
  const h = await headers();
  const forwarded = h.get('x-forwarded-for');
  if (forwarded) return forwarded.split(',')[0].trim();
  return h.get('x-real-ip') ?? 'desconocida';
}

/**
 * Aplica el freno o lanza `TooManyRequestsError`.
 *
 * @param {keyof typeof RULES} flow
 * @param {{ email?: string }} [context]
 * @returns {Promise<{ ip: string }>} la IP, que quien llama suele querer registrar
 */
export async function throttleAuth(flow, { email } = {}) {
  const rule = RULES[flow];
  if (!rule) throw new Error(`Flujo de autenticación desconocido: ${flow}`);

  const ip = await clientIp();
  const minutes = Math.round(WINDOW_MS / 60000);

  // El cupo por IP se consume siempre; el de email solo si viene.
  try {
    consumeRateLimit(`auth:${flow}:ip:${ip}`, { limit: rule.ip, windowMs: WINDOW_MS });
    if (email) {
      consumeRateLimit(`auth:${flow}:email:${String(email).toLowerCase()}`, {
        limit: rule.email,
        windowMs: WINDOW_MS,
      });
    }
  } catch (err) {
    if (err instanceof TooManyRequestsError) {
      throw new TooManyRequestsError(
        `Demasiados intentos. Espera ${minutes} minutos y vuelve a probar.`,
        { retryAfterMs: err.retryAfterMs },
      );
    }
    throw err;
  }

  return { ip };
}
