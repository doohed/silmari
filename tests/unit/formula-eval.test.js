import { describe, it, expect } from 'vitest';
import {
  parseFormula,
  formulaDependencies,
  evaluateFormula,
} from '@/lib/field-types/formula-eval';

describe('parseFormula', () => {
  it('acepta expresiones válidas', () => {
    expect(() => parseFormula('a + b * 2')).not.toThrow();
    expect(() => parseFormula('(a - b) / 3')).not.toThrow();
    expect(() => parseFormula('-a')).not.toThrow();
  });

  it('rechaza sintaxis inválida', () => {
    expect(() => parseFormula('a +')).toThrow();
    expect(() => parseFormula('a b')).toThrow();
    expect(() => parseFormula('(a + b')).toThrow();
    expect(() => parseFormula('')).toThrow();
    expect(() => parseFormula('a $ b')).toThrow();
  });
});

describe('formulaDependencies', () => {
  it('devuelve los campos referenciados, únicos', () => {
    expect(formulaDependencies('amount * probability / 100').sort()).toEqual([
      'amount',
      'probability',
    ]);
    expect(formulaDependencies('x + x + y').sort()).toEqual(['x', 'y']);
  });
});

describe('evaluateFormula', () => {
  it('respeta precedencia y paréntesis', () => {
    expect(evaluateFormula('2 + 3 * 4', {})).toBe(14);
    expect(evaluateFormula('(2 + 3) * 4', {})).toBe(20);
  });

  it('resuelve referencias desde el scope', () => {
    expect(evaluateFormula('amount * probability / 100', { amount: 1000, probability: 40 })).toBe(
      400,
    );
  });

  it('negación unaria', () => {
    expect(evaluateFormula('-a + 5', { a: 3 })).toBe(2);
  });

  it('campos ausentes o no numéricos cuentan como 0', () => {
    expect(evaluateFormula('a + b', { a: 5 })).toBe(5);
    expect(evaluateFormula('a + b', { a: 5, b: 'x' })).toBe(5);
  });

  it('división por cero → null', () => {
    expect(evaluateFormula('a / b', { a: 5, b: 0 })).toBeNull();
  });
});
