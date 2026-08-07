/**
 * Nombres reservados que no puede usar la metadata definida por el usuario.
 */

/** Keys de sistema del documento de registro (colisionarían con la estructura). */
export const RESERVED_FIELD_NAMES = new Set([
  'id',
  '_id',
  '__v',
  'createdAt',
  'updatedAt',
  'deletedAt',
  'workspaceId',
  'objectMetadataId',
  'data',
  'position',
  'searchText',
  'createdBy',
]);

/** Slugs de objeto reservados (chocan con rutas de la app). */
export const RESERVED_OBJECT_SLUGS = new Set([
  'settings',
  'search',
  'trash',
  'objects',
  'api',
  'v1',
  'metadata',
  'tasks',
  'new',
  'login',
  'signup',
  'invite',
  'health',
]);

const CAMEL_CASE = /^[a-z][a-zA-Z0-9]*$/;

/** ¿`name` es camelCase válido para un campo/objeto? */
export function isCamelCase(name) {
  return CAMEL_CASE.test(name);
}

/** @param {string} name */
export function isReservedFieldName(name) {
  return RESERVED_FIELD_NAMES.has(name);
}

/** @param {string} slug */
export function isReservedObjectSlug(slug) {
  return RESERVED_OBJECT_SLUGS.has(slug);
}
