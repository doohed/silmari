import { DomainError, NotFoundError, ValidationError } from '@/lib/errors/domain-errors';
import { logger } from '@/lib/utils/logger';

/**
 * Traduce los errores de Mongoose/BSON que en realidad son entrada inválida.
 *
 * Un id que no es un ObjectId (`/objects/companies/pepito`, un cursor
 * manipulado) hace que Mongoose lance `CastError`. Como no es un `DomainError`,
 * salía como **500 «Error interno»** y se escribía en el log de errores: ruido
 * que tapa los fallos de verdad y una forma barata de llenarlo.
 *
 * Un id imposible se responde **404**, no 400: desde fuera no se distingue de un
 * id que simplemente no existe, y así no se filtra cuál de las dos cosas es.
 *
 * @param {unknown} err
 * @returns {unknown} el mismo error, o el error de dominio equivalente
 */
function asDomainError(err) {
  if (err instanceof DomainError) return err;
  const name = err?.name;
  if (name === 'BSONError' || name === 'BSONTypeError') return new NotFoundError('No encontrado');
  if (name === 'CastError') {
    return err.kind === 'ObjectId' || err.path === '_id'
      ? new NotFoundError('No encontrado')
      : new ValidationError('Datos no válidos');
  }
  return err;
}

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
export function toActionError(rawErr) {
  const err = asDomainError(rawErr);
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
export function errorResponse(rawErr) {
  const err = asDomainError(rawErr);
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
