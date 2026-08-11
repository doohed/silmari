import { describe, it, expect } from 'vitest';
import { coerceValue } from '@/lib/intake/mapping';

describe('coerceValue', () => {
  it('FULL_NAME parte "Ana Ruiz" en nombre y apellidos', () => {
    expect(coerceValue({ type: 'FULL_NAME' }, 'Ana Ruiz')).toEqual({
      firstName: 'Ana',
      lastName: 'Ruiz',
    });
  });

  it('FULL_NAME respeta un objeto ya estructurado', () => {
    const v = { firstName: 'Ana', lastName: 'Ruiz' };
    expect(coerceValue({ type: 'FULL_NAME' }, v)).toBe(v);
  });

  it('EMAILS normaliza a minúsculas y array', () => {
    expect(coerceValue({ type: 'EMAILS' }, 'Ana@X.com')).toEqual(['ana@x.com']);
  });

  it('PHONES devuelve array de strings recortados', () => {
    expect(coerceValue({ type: 'PHONES' }, ' +34 600 ')).toEqual(['+34 600']);
  });

  it('SELECT casa por etiqueta o por value y devuelve el value', () => {
    const field = { type: 'SELECT', options: [{ value: 'nuevo', label: 'Nuevo' }] };
    expect(coerceValue(field, 'Nuevo')).toBe('nuevo');
    expect(coerceValue(field, 'nuevo')).toBe('nuevo');
  });

  it('SELECT sin coincidencia deja el valor tal cual (lo rechazará la validación)', () => {
    const field = { type: 'SELECT', options: [{ value: 'a', label: 'A' }] };
    expect(coerceValue(field, 'desconocido')).toBe('desconocido');
  });

  it('LINKS envuelve una URL suelta', () => {
    expect(coerceValue({ type: 'LINKS' }, 'https://x.com')).toEqual([
      { url: 'https://x.com', label: '' },
    ]);
  });

  it('texto plano pasa tal cual; vacío/nulo → null', () => {
    expect(coerceValue({ type: 'TEXT' }, 'Hola')).toBe('Hola');
    expect(coerceValue({ type: 'TEXT' }, '')).toBeNull();
    expect(coerceValue({ type: 'TEXT' }, null)).toBeNull();
  });
});
