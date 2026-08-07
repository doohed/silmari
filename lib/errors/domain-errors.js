/**
 * Errores de dominio. Se lanzan desde la capa de servicios y se traducen a
 * respuestas HTTP o resultados de Server Action mediante `lib/errors/to-response.js`.
 * Nunca exponen stack traces al cliente.
 */

/** Error base de dominio. */
export class DomainError extends Error {
  /**
   * @param {string} message Mensaje seguro para mostrar al usuario.
   * @param {object} [options]
   * @param {string} [options.code] Código estable para el cliente/logs.
   * @param {Record<string, string[]>} [options.fieldErrors] Errores por campo (formularios).
   */
  constructor(message, { code, fieldErrors } = {}) {
    super(message);
    this.name = this.constructor.name;
    this.code = code ?? 'DOMAIN_ERROR';
    this.status = 500;
    if (fieldErrors) this.fieldErrors = fieldErrors;
  }
}

/** Entrada inválida (400). Puede llevar errores por campo. */
export class ValidationError extends DomainError {
  constructor(message = 'Datos inválidos', { code = 'VALIDATION', fieldErrors } = {}) {
    super(message, { code, fieldErrors });
    this.status = 400;
  }
}

/** No autenticado (401). */
export class UnauthorizedError extends DomainError {
  constructor(message = 'No has iniciado sesión', { code = 'UNAUTHORIZED' } = {}) {
    super(message, { code });
    this.status = 401;
  }
}

/** Autenticado pero sin permiso (403). */
export class ForbiddenError extends DomainError {
  constructor(message = 'No tienes permiso para esta acción', { code = 'FORBIDDEN' } = {}) {
    super(message, { code });
    this.status = 403;
  }
}

/** Recurso no encontrado (404). */
export class NotFoundError extends DomainError {
  constructor(message = 'No encontrado', { code = 'NOT_FOUND' } = {}) {
    super(message, { code });
    this.status = 404;
  }
}

/** Conflicto de estado, p. ej. unicidad (409). */
export class ConflictError extends DomainError {
  constructor(message = 'Conflicto', { code = 'CONFLICT', fieldErrors } = {}) {
    super(message, { code, fieldErrors });
    this.status = 409;
  }
}

/** Se ha superado el límite de peticiones (429). */
export class TooManyRequestsError extends DomainError {
  constructor(message = 'Demasiadas peticiones', { code = 'RATE_LIMITED', retryAfterMs } = {}) {
    super(message, { code });
    this.status = 429;
    this.retryAfterMs = retryAfterMs;
  }
}
