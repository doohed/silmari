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
});
