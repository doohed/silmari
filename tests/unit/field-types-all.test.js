import { describe, it, expect } from 'vitest';
import { getFieldType, FIELD_TYPES } from '@/lib/field-types';

/**
 * Casos por tipo: valor válido, (opcional) inválido, y searchText esperado.
 * Cubre schema + normalize + toSearchText de los 22 tipos.
 */
const CASES = {
  TEXT: { meta: {}, valid: 'hola', invalid: 5, search: 'hola' },
  RICH_TEXT: { meta: {}, valid: '<b>hi</b>', search: ' hi ' },
  NUMBER: { meta: {}, valid: 42, invalid: 'x', search: '42' },
  CURRENCY: { meta: {}, valid: { amount: 10, currencyCode: 'EUR' }, invalid: 5, search: '10' },
  PERCENT: { meta: {}, valid: 50, invalid: 'x', search: '50%' },
  BOOLEAN: { meta: {}, valid: true, invalid: 'x', search: '' },
  DATE: { meta: {}, valid: '2020-01-02T00:00:00.000Z', search: '2020-01-02' },
  DATE_TIME: { meta: {}, valid: '2020-01-02T03:04:00.000Z', search: '2020-01-02T03:04:00.000Z' },
  SELECT: {
    meta: { options: [{ value: 'a', label: 'A' }] },
    valid: 'a',
    invalid: 'z',
    search: 'A',
  },
  MULTI_SELECT: {
    meta: { options: [{ value: 'a', label: 'A' }] },
    valid: ['a'],
    invalid: ['z'],
    search: 'A',
  },
  EMAILS: { meta: {}, valid: ['a@b.com'], invalid: ['no'], search: 'a@b.com' },
  PHONES: { meta: {}, valid: ['600'], search: '600' },
  LINKS: { meta: {}, valid: [{ url: 'https://x.com', label: 'X' }], search: 'X https://x.com' },
  FULL_NAME: { meta: {}, valid: { firstName: 'Ada', lastName: 'B' }, search: 'Ada B' },
  ADDRESS: { meta: {}, valid: { city: 'Madrid', country: 'ES' }, search: 'Madrid ES' },
  RATING: { meta: {}, valid: 3, invalid: 9, search: '' },
  RELATION: { meta: { relation: { type: 'MANY_TO_ONE' } }, valid: 'abc', search: '' },
  MEMBER: { meta: {}, valid: 'user123', search: '' },
  ARRAY: { meta: {}, valid: ['x', 'y'], search: 'x y' },
  RAW_JSON: { meta: {}, valid: { a: 1 }, search: '' },
  ACTOR: { meta: {}, valid: { name: 'Ada', source: 'MANUAL' }, search: 'Ada' },
  POSITION: { meta: {}, valid: 'a0', search: '' },
  UUID: {
    meta: {},
    valid: '00000000-0000-0000-0000-000000000000',
    invalid: 'x',
    search: '00000000-0000-0000-0000-000000000000',
  },
  // Calculado: no se guarda (normalize → undefined), searchText vacío.
  FORMULA: { meta: { settings: { formula: 'a + b' } }, valid: null, search: '' },
};

describe('cobertura de los tipos de campo', () => {
  it('todos los tipos tienen caso de prueba', () => {
    expect(Object.keys(CASES).sort()).toEqual([...FIELD_TYPES].sort());
  });

  for (const [type, c] of Object.entries(CASES)) {
    it(`${type}: schema/normalize/searchText`, () => {
      const def = getFieldType(type);
      // Válido pasa el schema.
      expect(def.schema(c.meta).safeParse(c.valid).success).toBe(true);
      // Inválido lo rechaza (si se define).
      if ('invalid' in c) {
        expect(def.schema(c.meta).safeParse(c.invalid).success).toBe(false);
      }
      // normalize no rompe y searchText coincide.
      const norm = def.normalize(c.valid, c.meta);
      expect(def.toSearchText(norm, c.meta)).toBe(c.search);
      // buildFilter isEmpty produce un objeto de match.
      if (def.filterOperators.includes('isEmpty')) {
        expect(typeof def.buildFilter('campo', 'isEmpty')).toBe('object');
      }
    });
  }
});
