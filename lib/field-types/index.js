import { scalarTypes } from './scalar';
import { choiceTypes } from './choice';
import { compositeTypes } from './composite';
import { specialTypes } from './special';
import { isRootField } from '@/lib/records/field-path';

/**
 * Registry de tipos de campo. Cada definición aporta la parte servidor:
 * `schema(fieldMeta)`, `defaultValue`, `normalize`, `filterOperators`,
 * `buildFilter`, `compare`, `toSearchText`. Los componentes Display/Edit se
 * añaden en la Fase 4 (necesitan el contexto de tabla/ficha).
 */

const ALL = [...scalarTypes, ...choiceTypes, ...compositeTypes, ...specialTypes];

/** @type {Map<string, typeof ALL[number]>} */
const REGISTRY = new Map(ALL.map((def) => [def.type, def]));

/** Lista de identificadores de tipo soportados. */
export const FIELD_TYPES = ALL.map((d) => d.type);

/**
 * Devuelve la definición de un tipo de campo.
 * @param {string} type
 * @returns {typeof ALL[number]}
 */
export function getFieldType(type) {
  const def = REGISTRY.get(type);
  if (!def) throw new Error(`Tipo de campo desconocido: ${type}`);
  return def;
}

/** @param {string} type @returns {boolean} */
export function isValidFieldType(type) {
  return REGISTRY.has(type);
}

/**
 * ¿Acepta este campo valores del cliente? Los campos de sistema (los que viven
 * en la raíz del documento) y los tipos marcados `isReadOnly` los escribe solo
 * el servidor: no se validan, ni se importan, ni se editan en sitio.
 * @param {{ name: string, type: string, isSystem?: boolean }} field FieldMetadata DTO
 * @returns {boolean}
 */
export function isWritableField(field) {
  return !isRootField(field) && !getFieldType(field.type).isReadOnly;
}

/**
 * ¿Se puede ordenar la lista por este campo **en la base de datos**?
 *
 * La paginación es por cursor sobre `(sortValue, _id)` y `decodeCursor`
 * descarta un `sortValue` que no sea escalar (si no, el cliente escribiría
 * operadores de Mongo dentro del match). Así que un tipo solo es ordenable si
 * su valor —o la hoja a la que apunte su `sortPath`— es un escalar: los arrays
 * (EMAILS, MULTI_SELECT…) y los calculados que no se persisten (FORMULA,
 * ROLLUP) se marcan `isSortable: false`.
 *
 * Sin esta comprobación el fallo era **silencioso y feo**: el cursor salía con
 * un objeto dentro, se descartaba al decodificarlo, y la petición de la
 * siguiente página volvía a traer la primera — filas duplicadas hasta el
 * infinito al hacer scroll.
 *
 * @param {{ type: string }} field FieldMetadata DTO
 * @returns {boolean}
 */
export function isSortableField(field) {
  return getFieldType(field.type).isSortable !== false;
}
