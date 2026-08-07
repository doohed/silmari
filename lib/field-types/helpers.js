import { z } from 'zod';

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
