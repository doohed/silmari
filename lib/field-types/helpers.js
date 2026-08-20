import { z } from 'zod';
import { ValidationError } from '@/lib/errors/domain-errors';

/**
 * Helpers compartidos por las definiciones de tipos de campo.
 */

/** Escapa una cadena para usarla como literal dentro de una expresión regular. */
export function escapeRegex(input) {
  return String(input).replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

/**
 * Envuelve un schema Zod para respetar `isNullable`: si el campo admite nulos,
 * acepta también `null`/`undefined`.
 * @param {import('zod').ZodType} schema
 * @param {{ isNullable?: boolean }} fieldMeta
 */
export function nullable(schema, fieldMeta) {
  return fieldMeta?.isNullable === false ? schema : schema.nullish();
}

/** Ruta del valor dentro del documento de registro. */
export function dataPath(fieldName) {
  return `data.${fieldName}`;
}

/**
 * Filtro de vacío/no-vacío común (null, ausente o string vacío).
 * @param {string} path
 * @param {'isEmpty'|'isNotEmpty'} op
 */
export function emptinessFilter(path, op) {
  const empty = { $or: [{ [path]: null }, { [path]: { $exists: false } }, { [path]: '' }] };
  return op === 'isEmpty' ? empty : { $nor: [empty] };
}

/** Comparador genérico para ordenación (null al final). */
export function defaultCompare(a, b) {
  if (a == null && b == null) return 0;
  if (a == null) return 1;
  if (b == null) return -1;
  if (a < b) return -1;
  if (a > b) return 1;
  return 0;
}

/** Operadores que esperan una lista de valores en vez de uno solo. */
const ARRAY_OPERATORS = new Set(['isAnyOf', 'isNoneOf', 'containsAny', 'containsAll']);

/**
 * Recorta un valor de filtro a lo que un valor de filtro puede ser.
 *
 * Los valores llegan del cliente y los `buildFilter` de cada tipo los incrustan
 * directamente en el match (`{ 'data.nombre': value }`). Si dejáramos pasar un
 * objeto, Mongo lo leería como un **operador** (`{$regex}`, `{$ne}`, `{$gt}`…) y
 * el cliente pasaría de elegir un filtro a escribir la consulta: podría montar
 * una regex de backtracking catastrófico y quemar la CPU de la base de datos
 * recorriendo la colección documento a documento.
 *
 * No hay ningún filtro legítimo con forma de objeto: el editor de filtros y la
 * API pública solo mandan cadenas (y listas de cadenas en los operadores de
 * conjunto). Así que la coacción es cerrar la puerta, no cambiar el
 * comportamiento.
 *
 * @param {any} value valor tal cual lo manda el cliente
 * @param {string} operator operador ya validado contra `filterOperators`
 * @returns {any} escalar, o array de escalares para los operadores de conjunto
 */
export function coerceFilterValue(value, operator) {
  const scalar = (v) => {
    if (v === null || v === undefined) return null;
    if (typeof v === 'object' || typeof v === 'function') {
      throw new ValidationError('Valor de filtro no válido');
    }
    return v;
  };
  if (ARRAY_OPERATORS.has(operator)) {
    // Un valor suelto se envuelve: `$in` con algo que no es array revienta en
    // Mongo, y el editor de filtros manda una cadena.
    return (Array.isArray(value) ? value : [value]).map(scalar);
  }
  return scalar(value);
}

/** Conjuntos de operadores de filtro reutilizables. */
export const OPERATORS = {
  text: ['eq', 'neq', 'contains', 'notContains', 'startsWith', 'endsWith', 'isEmpty', 'isNotEmpty'],
  number: ['eq', 'neq', 'gt', 'gte', 'lt', 'lte', 'isEmpty', 'isNotEmpty'],
  date: ['eq', 'neq', 'before', 'after', 'isEmpty', 'isNotEmpty'],
  boolean: ['eq'],
  select: ['is', 'isNot', 'isAnyOf', 'isNoneOf', 'isEmpty', 'isNotEmpty'],
  multiSelect: ['containsAny', 'containsAll', 'isEmpty', 'isNotEmpty'],
  arrayLike: ['contains', 'isEmpty', 'isNotEmpty'],
  minimal: ['eq', 'neq', 'isEmpty', 'isNotEmpty'],
};

export { z };
