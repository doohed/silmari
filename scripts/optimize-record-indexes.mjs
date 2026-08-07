import mongoose from 'mongoose';
import { connectToDatabase } from '@/lib/db/connect';
import Record from '@/models/Record';
import ObjectMetadata from '@/models/ObjectMetadata';
import FieldMetadata from '@/models/FieldMetadata';
import { syncFieldIndex } from '@/lib/db/indexes';

/**
 * Migración de índices (punto 2 de optimización de tabla):
 *  1. Crea el índice base nuevo {workspaceId, objectMetadataId, deletedAt, position}.
 *  2. Borra el índice antiguo {workspaceId, objectMetadataId, position} (redundante).
 *  3. Marca como indexado el campo identificador de cada objeto y construye su
 *     índice compartido `fld_<name>` (típicamente `fld_name`).
 * Idempotente. Uso:
 *   MONGODB_URI=... node --no-warnings --loader ./scripts/alias-loader.mjs \
 *     scripts/optimize-record-indexes.mjs
 */
await connectToDatabase();

// Borra variantes antiguas del índice de position antes de crear la definitiva.
for (const name of [
  'workspaceId_1_objectMetadataId_1_position_1',
  'workspaceId_1_objectMetadataId_1_deletedAt_1_position_1',
]) {
  try {
    await Record.collection.dropIndex(name);
    console.log('Índice antiguo borrado:', name);
  } catch {
    /* no existía */
  }
}
await Record.createIndexes();

// Marca como indexado el campo identificador de cada objeto.
const objs = await ObjectMetadata.find({ labelIdentifierFieldId: { $ne: null }, deletedAt: null })
  .select('labelIdentifierFieldId')
  .lean();
const idIds = objs.map((o) => o.labelIdentifierFieldId).filter(Boolean);
const upd = await FieldMetadata.updateMany({ _id: { $in: idIds } }, { $set: { isIndexed: true } });

// Reconstruye TODOS los índices dinámicos con la forma nueva (dedupe por nombre).
const indexed = await FieldMetadata.find({
  deletedAt: null,
  $or: [{ isIndexed: true }, { isUnique: true }],
})
  .select('name isUnique isIndexed')
  .lean();
const seen = new Set();
for (const f of indexed) {
  const key = `${f.name}:${f.isUnique ? 'u' : 'i'}`;
  if (seen.has(key)) continue;
  seen.add(key);
  await syncFieldIndex(f);
}

const count = (await Record.collection.indexes()).length;
console.log(
  `Identificadores marcados indexados: ${upd.modifiedCount}. Índices dinámicos reconstruidos: ${seen.size}. Índices totales en records: ${count}/64.`,
);
await mongoose.disconnect();
