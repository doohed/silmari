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
  const name = indexName(field);
  const options = { name };

  // Único: clave `(ws, objeto, data.<campo>)` con unicidad parcial (por tenant y
  // objeto). No-único (indexado para filtrar/ordenar): `(ws, objeto, deletedAt,
  // data.<campo>, _id)` → cubre tanto el filtro `deletedAt:null` como el orden
  // por esa columna (con `_id` de desempate), evitando el SORT en memoria.
  let key;
  if (field.isUnique) {
    key = { workspaceId: 1, objectMetadataId: 1, [path]: 1 };
    options.unique = true;
    options.partialFilterExpression = { [path]: { $exists: true } };
  } else {
    key = { workspaceId: 1, objectMetadataId: 1, deletedAt: 1, [path]: 1, _id: 1 };
  }

  const coll = recordsCollection();
  // Si el índice ya existe con otra forma (migración de esquema), recréalo.
  const existing = (await coll.indexes()).find((i) => i.name === name);
  if (existing && JSON.stringify(existing.key) !== JSON.stringify(key)) {
    await coll.dropIndex(name);
  }
  const created = await coll.createIndex(key, options);
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
