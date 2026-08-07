import mongoose from 'mongoose';
import { logger } from '@/lib/utils/logger';

/**
 * Gestión de índices dinámicos sobre `records.data.<campo>`.
 *
 * Política (decisión Fase 2): solo se indexan campos `isUnique` o `isIndexed`.
 *
 * **Índice compartido por nombre de campo.** La colección `records` es única y
 * MongoDB limita a 64 índices por colección. Para no crear un índice por cada
 * (workspace, objeto, campo) —lo que agotaría el límite con pocos workspaces—,
 * creamos UN índice por nombre de campo (`fld_<name>`), con clave
 * `(workspaceId, objectMetadataId, data.<name>)`. Como workspaceId y
 * objectMetadataId están en la clave, el mismo índice sirve a todos los objetos
 * y workspaces que tengan un campo con ese nombre, y la unicidad queda acotada
 * por tenant y objeto. Así el nº de índices depende de los nombres de campo
 * distintos, no del nº de workspaces.
 *
 * Trade-off asumido: si dos objetos usan un campo con el mismo nombre pero con
 * intención de índice distinta (único vs. no único), hay ambigüedad (documentado).
 */

const COLLECTION = 'records';

/** Nombre estable del índice de un campo (compartido por nombre de campo). */
function indexName(field) {
  return `fld_${field.name}${field.isUnique ? '_uq' : ''}`;
}

function recordsCollection() {
  return mongoose.connection.collection(COLLECTION);
}

/**
 * ¿Este campo debe tener índice dinámico?
 * @param {{ isUnique?: boolean, isIndexed?: boolean }} field
 */
export function fieldNeedsIndex(field) {
  return Boolean(field.isUnique || field.isIndexed);
}

/**
 * Crea (o asegura) el índice de un campo si su política lo requiere. Idempotente:
 * varios objetos con el mismo nombre de campo comparten el índice.
 * @param {{ name: string, isUnique?: boolean, isIndexed?: boolean }} field
 * @returns {Promise<string | null>} nombre del índice creado, o null si no aplica
 */
export async function syncFieldIndex(field) {
  if (!fieldNeedsIndex(field)) return null;

  const path = `data.${field.name}`;
  const key = { workspaceId: 1, objectMetadataId: 1, [path]: 1 };
  const options = { name: indexName(field) };
  if (field.isUnique) {
    options.unique = true;
    // Solo aplica unicidad a documentos que tienen el campo (excluye nulos).
    options.partialFilterExpression = { [path]: { $exists: true } };
  }

  const created = await recordsCollection().createIndex(key, options);
  logger.debug('Índice dinámico asegurado', created);
  return created;
}

/**
 * En este modelo los índices son COMPARTIDOS por nombre de campo entre objetos y
 * workspaces, así que borrar un campo NO elimina su índice (rompería a otros
 * objetos con el mismo nombre). El índice es inocuo si queda sin uso.
 */
export async function dropFieldIndex() {
  // No-op intencional: ver nota arriba.
}
