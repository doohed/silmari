import mongoose from 'mongoose';
import { connectToDatabase } from '@/lib/db/connect';
import ObjectMetadata from '@/models/ObjectMetadata';
import FieldMetadata from '@/models/FieldMetadata';

/**
 * Migración: convierte los índices únicos de metadata en PARCIALES (solo
 * `deletedAt: null`), para que un objeto/campo borrado (soft delete) no bloquee
 * reutilizar su slug/nombre. Idempotente. Uso:
 *   MONGODB_URI=... node --no-warnings --loader ./scripts/alias-loader.mjs \
 *     scripts/fix-metadata-unique-indexes.mjs
 */
await connectToDatabase();

async function repartial(Model, oldName) {
  try {
    await Model.collection.dropIndex(oldName);
    console.log('Índice antiguo borrado:', oldName);
  } catch {
    console.log('Índice antiguo no existía (ok):', oldName);
  }
  await Model.createIndexes(); // crea el parcial definido en el esquema
}

await repartial(ObjectMetadata, 'workspaceId_1_slug_1');
await repartial(FieldMetadata, 'workspaceId_1_objectMetadataId_1_name_1');

console.log('Listo. Índices únicos de metadata ahora son parciales (deletedAt:null).');
await mongoose.disconnect();
