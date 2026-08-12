import { describe, it, expect } from 'vitest';
import { aggregateRollup, ROLLUP_OPERATIONS } from '@/lib/field-types/rollup-eval';

describe('aggregateRollup', () => {
  it('count cuenta elementos, ignorando el valor', () => {
    expect(aggregateRollup('count', [0, 0, 0])).toBe(3);
    expect(aggregateRollup('count', [])).toBe(0);
  });

  it('sum / avg / min / max sobre numéricos', () => {
    expect(aggregateRollup('sum', [100, 250])).toBe(350);
    expect(aggregateRollup('avg', [100, 200])).toBe(150);
    expect(aggregateRollup('min', [5, 2, 9])).toBe(2);
    expect(aggregateRollup('max', [5, 2, 9])).toBe(9);
  });

  it('lista vacía → 0 para las agregaciones numéricas', () => {
    for (const op of ['sum', 'avg', 'min', 'max']) expect(aggregateRollup(op, [])).toBe(0);
  });

  it('descarta valores no finitos', () => {
    expect(aggregateRollup('sum', [10, NaN, Infinity, 5])).toBe(15);
  });

  it('operación desconocida → 0', () => {
    expect(aggregateRollup('bogus', [1, 2])).toBe(0);
  });

  it('expone las operaciones admitidas', () => {
    expect(ROLLUP_OPERATIONS).toEqual(['count', 'sum', 'avg', 'min', 'max']);
  });
});
