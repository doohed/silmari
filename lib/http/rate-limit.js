import { TooManyRequestsError } from '@/lib/errors/domain-errors';

/**
 * Rate limiting básico en memoria (ventana fija) por clave. Decisión Fase 3:
 * simple y sin latencia; NO es compartido entre instancias y se reinicia con el
 * proceso. Para producción se sustituiría por un almacén compartido (Redis/Mongo).
 */

/** @type {Map<string, { count: number, windowStart: number }>} */
const buckets = new Map();

/**
 * Consume una unidad de cuota para `key`. Lanza TooManyRequestsError si se supera.
 * @param {string} key
 * @param {{ limit?: number, windowMs?: number, now?: number }} [opts]
 * @returns {{ remaining: number, resetAt: number }}
 */
export function consumeRateLimit(key, { limit = 120, windowMs = 60_000, now = Date.now() } = {}) {
  const bucket = buckets.get(key);
  if (!bucket || now - bucket.windowStart >= windowMs) {
    buckets.set(key, { count: 1, windowStart: now });
    return { remaining: limit - 1, resetAt: now + windowMs };
  }

  if (bucket.count >= limit) {
    const resetAt = bucket.windowStart + windowMs;
    throw new TooManyRequestsError('Demasiadas peticiones, inténtalo más tarde', {
      retryAfterMs: resetAt - now,
    });
  }

  bucket.count += 1;
  return { remaining: limit - bucket.count, resetAt: bucket.windowStart + windowMs };
}

/** Solo para tests: limpia el estado. */
export function _resetRateLimit() {
  buckets.clear();
}
