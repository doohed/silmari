import { describe, it, expect } from 'vitest';
import { encodeCursor, decodeCursor } from '@/lib/utils/cursor';

describe('cursor', () => {
  it('codifica y decodifica ida y vuelta', () => {
    const c = encodeCursor({ sortValue: 42, id: 'abc' });
    expect(typeof c).toBe('string');
    expect(decodeCursor(c)).toEqual({ sortValue: 42, id: 'abc' });
  });

  it('devuelve null para cursores inválidos o vacíos', () => {
    expect(decodeCursor(undefined)).toBeNull();
    expect(decodeCursor('')).toBeNull();
    expect(decodeCursor('no-base64-json')).toBeNull();
  });

  it('descarta un sortValue con forma de objeto', () => {
    // Acabaría dentro del match de Mongo como operador; se trata como corrupto.
    expect(decodeCursor(encodeCursor({ sortValue: { $ne: null }, id: 'abc' }))).toBeNull();
    expect(decodeCursor(encodeCursor({ sortValue: ['a'], id: 'abc' }))).toBeNull();
    // Los escalares y el null siguen pasando.
    expect(decodeCursor(encodeCursor({ sortValue: null, id: 'abc' }))).toEqual({
      sortValue: null,
      id: 'abc',
    });
  });
});
