import { describe, it, expect } from 'vitest';
import { FIELD_TYPES, getFieldType, isValidFieldType } from '@/lib/field-types';

const EXPECTED = [
  'TEXT',
  'RICH_TEXT',
  'NUMBER',
  'CURRENCY',
  'PERCENT',
  'BOOLEAN',
  'DATE',
  'DATE_TIME',
  'SELECT',
  'MULTI_SELECT',
  'EMAILS',
  'PHONES',
  'LINKS',
  'FULL_NAME',
  'ADDRESS',
  'RATING',
  'RELATION',
  'ARRAY',
  'RAW_JSON',
  'ACTOR',
  'POSITION',
  'UUID',
  'MEMBER',
  'FORMULA',
];

describe('registry de tipos de campo', () => {
  it('registra los tipos del brief más MEMBER (referido)', () => {
    for (const t of EXPECTED) expect(isValidFieldType(t)).toBe(true);
    expect(FIELD_TYPES).toHaveLength(EXPECTED.length);
  });

  it('cada tipo cumple el contrato servidor', () => {
    for (const t of EXPECTED) {
      const def = getFieldType(t);
      expect(typeof def.schema).toBe('function');
      expect(typeof def.defaultValue).toBe('function');
      expect(typeof def.normalize).toBe('function');
      expect(Array.isArray(def.filterOperators)).toBe(true);
      expect(typeof def.buildFilter).toBe('function');
      expect(typeof def.compare).toBe('function');
      expect(typeof def.toSearchText).toBe('function');
    }
  });

  it('TEXT valida, normaliza, filtra y genera searchText', () => {
    const t = getFieldType('TEXT');
    expect(t.schema({ isNullable: false }).safeParse('hola').success).toBe(true);
    expect(t.schema({ isNullable: false }).safeParse(123).success).toBe(false);
    expect(t.normalize(42)).toBe('42');
    expect(t.buildFilter('nombre', 'contains', 'ac')).toEqual({ 'data.nombre': /ac/i });
    expect(t.toSearchText('Acme')).toBe('Acme');
  });

  it('NUMBER traduce operadores de rango', () => {
    const n = getFieldType('NUMBER');
    expect(n.buildFilter('arr', 'gte', '10')).toEqual({ 'data.arr': { $gte: 10 } });
  });

  it('SELECT respeta las opciones declaradas', () => {
    const s = getFieldType('SELECT');
    const meta = {
      options: [
        { value: 'a', label: 'A' },
        { value: 'b', label: 'B' },
      ],
    };
    expect(s.schema(meta).safeParse('a').success).toBe(true);
    expect(s.schema(meta).safeParse('z').success).toBe(false);
    expect(s.toSearchText('a', meta)).toBe('A');
    expect(s.buildFilter('etapa', 'isAnyOf', ['a', 'b'])).toEqual({
      'data.etapa': { $in: ['a', 'b'] },
    });
  });

  it('MULTI_SELECT normaliza a array y filtra con $all', () => {
    const m = getFieldType('MULTI_SELECT');
    expect(m.normalize('x')).toEqual(['x']);
    expect(m.buildFilter('tags', 'containsAll', ['x', 'y'])).toEqual({
      'data.tags': { $all: ['x', 'y'] },
    });
  });

  it('FULL_NAME compone searchText', () => {
    const f = getFieldType('FULL_NAME');
    expect(f.toSearchText({ firstName: 'Ada', lastName: 'Lovelace' })).toBe('Ada Lovelace');
  });

  it('EMAILS valida direcciones y normaliza a minúsculas', () => {
    const e = getFieldType('EMAILS');
    expect(e.schema({}).safeParse(['a@b.com']).success).toBe(true);
    expect(e.schema({}).safeParse(['nope']).success).toBe(false);
    expect(e.normalize(['A@B.COM'])).toEqual(['a@b.com']);
  });

  it('RELATION MANY_TO_ONE guarda id; otros no van en data', () => {
    const r = getFieldType('RELATION');
    expect(r.schema({ relation: { type: 'MANY_TO_ONE' } }).safeParse('abc').success).toBe(true);
    expect(r.normalize('abc', { relation: { type: 'MANY_TO_ONE' } })).toBe('abc');
    expect(r.normalize('abc', { relation: { type: 'ONE_TO_MANY' } })).toBeUndefined();
  });
});
