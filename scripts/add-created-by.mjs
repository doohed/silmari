import mongoose from 'mongoose';
import { connectToDatabase } from '@/lib/db/connect';
import ObjectMetadata from '@/models/ObjectMetadata';
import FieldMetadata from '@/models/FieldMetadata';

/**
 * Migración: añade el campo de sistema `createdBy` (ACTOR, "Creado por") al
 * objeto Oportunidades de los workspaces creados antes de que existiera. Los
 * workspaces nuevos ya lo reciben en `seedStandardObjects`.
 *
 * No toca los registros: el valor ya está en `records.createdBy` desde la Fase 3
 * (los registros sin él se pintan como "Sistema"). Las vistas tampoco necesitan
 * migración: `getObjectViews` añade a cada vista los campos que aún no conoce.
 *
 * Es idempotente. Uso:
 *   MONGODB_URI=... node --no-warnings --loader ./scripts/alias-loader.mjs scripts/add-created-by.mjs
 */

await connectToDatabase();

const objects = await ObjectMetadata.find({ slug: 'opportunities', deletedAt: null }).lean();
let created = 0;
let skipped = 0;

for (const object of objects) {
  const exists = await FieldMetadata.findOne({
    workspaceId: object.workspaceId,
    objectMetadataId: object._id,
    name: 'createdBy',
  }).lean();
  if (exists) {
    skipped += 1;
    continue;
  }

  const last = await FieldMetadata.findOne({
    workspaceId: object.workspaceId,
    objectMetadataId: object._id,
  })
    .sort({ position: -1 })
    .select('position')
    .lean();

  await FieldMetadata.create({
    workspaceId: object.workspaceId,
    objectMetadataId: object._id,
    name: 'createdBy',
    label: 'Creado por',
    type: 'ACTOR',
    isNullable: true,
    isCustom: false,
    isSystem: true,
    isActive: true,
    position: (last?.position ?? -1) + 1,
  });
  created += 1;
}

console.log(
  `Oportunidades revisadas: ${objects.length} · creados: ${created} · ya existía: ${skipped}`,
);
await mongoose.disconnect();
