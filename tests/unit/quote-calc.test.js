import { describe, it, expect } from 'vitest';
import { lineSubtotal, lineTotal, quoteTotals } from '@/lib/quotes/calc';

describe('cálculo de líneas', () => {
  it('subtotal = cantidad × precio', () => {
    expect(lineSubtotal({ quantity: 3, unitPrice: 10 })).toBe(30);
  });

  it('total aplica el descuento (%)', () => {
    expect(lineTotal({ quantity: 2, unitPrice: 100, discount: 10 })).toBe(180);
  });

  it('acota el descuento a 0–100', () => {
    expect(lineTotal({ quantity: 1, unitPrice: 100, discount: 150 })).toBe(0);
    expect(lineTotal({ quantity: 1, unitPrice: 100, discount: -50 })).toBe(100);
  });

  it('trata valores ausentes/no numéricos como 0', () => {
    expect(lineSubtotal({})).toBe(0);
    expect(lineTotal({ quantity: 'x', unitPrice: 10 })).toBe(0);
  });

  it('quoteTotals suma subtotal, descuento y total', () => {
    const lines = [
      { quantity: 2, unitPrice: 100, discount: 0 }, // 200
      { quantity: 1, unitPrice: 100, discount: 10 }, // 90
    ];
    expect(quoteTotals(lines)).toEqual({
      count: 2,
      subtotal: 300,
      discountTotal: 10,
      total: 290,
    });
  });

  it('lista vacía / no-array → ceros', () => {
    expect(quoteTotals([])).toEqual({ count: 0, subtotal: 0, discountTotal: 0, total: 0 });
    expect(quoteTotals(null)).toEqual({ count: 0, subtotal: 0, discountTotal: 0, total: 0 });
  });

  it('redondea a 2 decimales sin deriva binaria', () => {
    expect(lineTotal({ quantity: 3, unitPrice: 0.1, discount: 0 })).toBe(0.3);
  });
});
