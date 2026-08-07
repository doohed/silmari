import mongoose from 'mongoose';
import { connectToDatabase } from '@/lib/db/connect';
import ObjectMetadata from '@/models/ObjectMetadata';
import FieldMetadata from '@/models/FieldMetadata';
import Record from '@/models/Record';
import View from '@/models/View';

/**
 * Migración: elimina el campo MEMBER "Referido" (`referredBy`) del objeto
 * Oportunidades en todos los workspaces. Su función pasa a "Creado por" (ACTOR),
 * que ya muestra al usuario creador. Los workspaces nuevos ya no lo reciben
 * (`seedStandardObjects`).
 *
 * Qué hace, de forma idempotente:
 *   1. Soft-delete del FieldMetadata `referredBy` (deletedAt + isActive:false).
 *   2. `$unset data.referredBy` en los registros de Oportunidades.
 *   3. Lo quita de `viewFields`/`viewFilters`/`viewSorts` de las vistas.
 *
 * Uso:
 *   MONGODB_URI=... node --no-warnings --loader ./scripts/alias-loader.mjs \
 *     scripts/remove-referred-by.mjs
 */

await connectToDatabase();

const objects = await ObjectMetadata.find({ nameSingular: 'opportunity', deletedAt: null }).lean();
let fieldsRemoved = 0;
let recordsCleaned = 0;
let viewsCleaned = 0;

for (const object of objects) {
  const field = await FieldMetadata.findOne({
    workspaceId: object.workspaceId,
    objectMetadataId: object._id,
    name: 'referredBy',
    deletedAt: null,
  });
  if (!field) continue;

  field.deletedAt = new Date();
  field.isActive = false;
  await field.save();
  fieldsRemoved += 1;

  const res = await Record.updateMany(
    { workspaceId: object.workspaceId, objectMetadataId: object._id },
    { $unset: { 'data.referredBy': '' } },
  );
  recordsCleaned += res.modifiedCount ?? 0;

  const fid = String(field._id);
  const views = await View.find({
    workspaceId: object.workspaceId,
    objectMetadataId: object._id,
    deletedAt: null,
  });
  for (const view of views) {
    const before = JSON.stringify([view.viewFields, view.viewFilters, view.viewSorts]);
    view.viewFields = (view.viewFields ?? []).filter((f) => String(f.fieldMetadataId) !== fid);
    view.viewFilters = (view.viewFilters ?? []).filter((f) => String(f.fieldMetadataId) !== fid);
    view.viewSorts = (view.viewSorts ?? []).filter((s) => String(s.fieldMetadataId) !== fid);
    if (JSON.stringify([view.viewFields, view.viewFilters, view.viewSorts]) !== before) {
      await view.save();
      viewsCleaned += 1;
    }
  }
}

console.log(
  `Listo. Campos borrados: ${fieldsRemoved}, registros limpiados: ${recordsCleaned}, vistas limpiadas: ${viewsCleaned}.`,
);
await mongoose.disconnect();
