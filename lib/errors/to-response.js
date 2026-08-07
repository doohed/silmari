import { DomainError } from '@/lib/errors/domain-errors';
import { logger } from '@/lib/utils/logger';

/**
 * @typedef {object} ActionError
 * @property {false} ok
 * @property {string} message Mensaje seguro para el usuario.
 * @property {string} code
 * @property {Record<string, string[]>} [fieldErrors]
 */

/**
 * Traduce un error a un resultado de Server Action. Los errores de dominio se
 * exponen tal cual (mensaje seguro); cualquier otro se registra y se devuelve
 * un mensaje genérico (nunca el stack al cliente).
 * @param {unknown} err
 * @returns {ActionError}
 */
export function toActionError(err) {
  if (err instanceof DomainError) {
    return { ok: false, message: err.message, code: err.code, fieldErrors: err.fieldErrors };
  }
  logger.error('Error no controlado en acción', err);
  return { ok: false, message: 'Ha ocurrido un error inesperado', code: 'INTERNAL' };
}

/**
 * Traduce un error a una `Response` JSON para los route handlers de la API.
 * @param {unknown} err
 * @returns {Response}
 */
export function errorResponse(err) {
  if (err instanceof DomainError) {
    const headers = {};
    if (err.status === 429 && err.retryAfterMs) {
      headers['Retry-After'] = String(Math.ceil(err.retryAfterMs / 1000));
    }
    return Response.json(
      { error: { code: err.code, message: err.message, fieldErrors: err.fieldErrors } },
      { status: err.status, headers },
    );
  }
  logger.error('Error no controlado en API', err);
  return Response.json(
    { error: { code: 'INTERNAL', message: 'Error interno del servidor' } },
    { status: 500 },
  );
}
