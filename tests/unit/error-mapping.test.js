import { describe, it, expect, vi, afterEach } from 'vitest';
import { errorResponse, toActionError } from '@/lib/errors/to-response';
import { NotFoundError } from '@/lib/errors/domain-errors';

/** Imita el CastError que lanza Mongoose ante un id que no es un ObjectId. */
function castError({ kind = 'ObjectId', path = '_id' } = {}) {
  const err = new Error(`Cast to ${kind} failed for value "pepito"`);
  err.name = 'CastError';
  err.kind = kind;
  err.path = path;
  return err;
}

describe('mapeo de errores de Mongoose', () => {
  afterEach(() => vi.restoreAllMocks());

  it('un id imposible es 404, no un 500', async () => {
    const res = errorResponse(castError());
    expect(res.status).toBe(404);
    // Desde fuera no se distingue de un id que no existe: así no se filtra cuál
    // de las dos cosas es.
    expect((await res.json()).error.code).toBe('NOT_FOUND');
  });

  it('un BSONError (ObjectId inválido en el cursor) también es 404', () => {
    const err = new Error('input must be a 24 character hex string');
    err.name = 'BSONError';
    expect(errorResponse(err).status).toBe(404);
  });

  it('un cast que no es de id es entrada inválida (400)', () => {
    expect(errorResponse(castError({ kind: 'Date', path: 'dueAt' })).status).toBe(400);
  });

  it('no escribe en el log de errores lo que ya no es un 500', () => {
    const spy = vi.spyOn(console, 'error').mockImplementation(() => {});
    errorResponse(castError());
    expect(spy).not.toHaveBeenCalled();
  });

  it('lo que de verdad es inesperado sigue siendo 500 genérico', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => {});
    const res = errorResponse(new TypeError('undefined no es una función'));
    expect(res.status).toBe(500);
    const body = await res.json();
    expect(body.error.message).toBe('Error interno del servidor');
    expect(body.error.message).not.toContain('undefined');
  });

  it('las server actions aplican el mismo mapeo', () => {
    expect(toActionError(castError())).toMatchObject({ ok: false, code: 'NOT_FOUND' });
  });

  it('los errores de dominio pasan tal cual', () => {
    expect(errorResponse(new NotFoundError('Registro no encontrado')).status).toBe(404);
  });
});
