import { describe, it, expect } from 'vitest';
import {
  conditionInputKind,
  operatorTakesValue,
  defaultConditionValue,
  castConditionValue,
} from '@/lib/automations/condition-value';

const stage = {
  type: 'SELECT',
  label: 'Etapa',
  options: [
    { value: 'nuevo', label: 'Nuevo' },
    { value: 'cliente', label: 'Cliente' },
  ],
};
const active = { type: 'BOOLEAN', label: 'Activo' };
const amount = { type: 'CURRENCY', label: 'Importe' };
const closedAt = { type: 'DATE', label: 'Cierre' };
const name = { type: 'TEXT', label: 'Nombre' };

describe('conditionInputKind', () => {
  it('agrupa los tipos por el control que necesitan', () => {
    expect(conditionInputKind('SELECT')).toBe('select');
    expect(conditionInputKind('MULTI_SELECT')).toBe('select');
    expect(conditionInputKind('BOOLEAN')).toBe('boolean');
    expect(conditionInputKind('NUMBER')).toBe('number');
    expect(conditionInputKind('CURRENCY')).toBe('number');
    expect(conditionInputKind('PERCENT')).toBe('number');
    expect(conditionInputKind('RATING')).toBe('number');
    expect(conditionInputKind('DATE')).toBe('date');
    expect(conditionInputKind('DATE_TIME')).toBe('datetime');
    expect(conditionInputKind('TEXT')).toBe('text');
    expect(conditionInputKind('EMAILS')).toBe('text');
  });
});

describe('operatorTakesValue y defaultConditionValue', () => {
  it('isEmpty / isNotEmpty no llevan valor', () => {
    expect(operatorTakesValue('isEmpty')).toBe(false);
    expect(operatorTakesValue('isNotEmpty')).toBe(false);
    expect(operatorTakesValue('eq')).toBe(true);
    expect(defaultConditionValue(stage, 'isEmpty')).toBeNull();
  });

  it('arranca en la primera opción del SELECT y en sí para un booleano', () => {
    expect(defaultConditionValue(stage, 'is')).toBe('nuevo');
    expect(defaultConditionValue(active, 'eq')).toBe(true);
    expect(defaultConditionValue(name, 'eq')).toBe('');
  });
});

describe('castConditionValue · SELECT', () => {
  it('acepta el value de una opción', () => {
    expect(castConditionValue('cliente', stage, 'is')).toEqual({ ok: true, value: 'cliente' });
  });

  it('acepta la etiqueta y guarda su value (es lo que compara el filtro)', () => {
    expect(castConditionValue('Cliente', stage, 'is')).toEqual({ ok: true, value: 'cliente' });
  });

  it('rechaza lo que no es una opción, y dice cuáles hay', () => {
    const r = castConditionValue('Prospecto', stage, 'is');
    expect(r.ok).toBe(false);
    expect(r.error).toMatch(/Nuevo, Cliente/);
  });

  it('valida elemento a elemento en los operadores de lista', () => {
    expect(castConditionValue(['nuevo', 'Cliente'], stage, 'isAnyOf')).toEqual({
      ok: true,
      value: ['nuevo', 'cliente'],
    });
    expect(castConditionValue(['nuevo', 'zzz'], stage, 'isAnyOf').ok).toBe(false);
  });
});

describe('castConditionValue · BOOLEAN', () => {
  it('entiende "no" y "false" como false', () => {
    // El motivo de todo esto: `Boolean('false')` es `true`, así que un texto
    // libre hacía imposible expresar «este campo está en no».
    expect(castConditionValue('false', active, 'eq')).toEqual({ ok: true, value: false });
    expect(castConditionValue('no', active, 'eq')).toEqual({ ok: true, value: false });
    expect(castConditionValue(false, active, 'eq')).toEqual({ ok: true, value: false });
  });

  it('entiende "sí" y "true" como true', () => {
    expect(castConditionValue('sí', active, 'eq')).toEqual({ ok: true, value: true });
    expect(castConditionValue('true', active, 'eq')).toEqual({ ok: true, value: true });
  });

  it('rechaza cualquier otra cosa', () => {
    expect(castConditionValue('quizá', active, 'eq').ok).toBe(false);
  });
});

describe('castConditionValue · números y fechas', () => {
  it('convierte a número y rechaza lo que no lo es', () => {
    expect(castConditionValue('1500', amount, 'gt')).toEqual({ ok: true, value: 1500 });
    expect(castConditionValue('mil quinientos', amount, 'gt').ok).toBe(false);
    expect(castConditionValue('', amount, 'gt').ok).toBe(false);
  });

  it('normaliza la fecha a ISO y rechaza una inválida', () => {
    const r = castConditionValue('2026-03-01', closedAt, 'before');
    expect(r.ok).toBe(true);
    expect(r.value).toBe(new Date('2026-03-01').toISOString());
    expect(castConditionValue('el martes', closedAt, 'before').ok).toBe(false);
  });
});

describe('castConditionValue · sin valor', () => {
  it('los operadores de vacío devuelven null sin mirar el valor', () => {
    expect(castConditionValue('lo que sea', amount, 'isEmpty')).toEqual({ ok: true, value: null });
  });
});
