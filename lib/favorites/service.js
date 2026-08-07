import { connectToDatabase } from '@/lib/db/connect';
import { assertTenant } from '@/lib/services/tenant';
import { ConflictError, NotFoundError } from '@/lib/errors/domain-errors';
import { getFieldType } from '@/lib/field-types';
import ObjectMetadata from '@/models/ObjectMetadata';
import FieldMetadata from '@/models/FieldMetadata';
import Record from '@/models/Record';
import Favorite from '@/models/Favorite';

/** Resuelve un favorito a `{ id, type, label, href, icon }` para el sidebar. */
async function resolveFavorite(ctx, fav) {
  if (fav.objectMetadataId) {
    const obj = await ObjectMetadata.findOne({
      _id: fav.objectMetadataId,
      workspaceId: ctx.workspaceId,
    }).lean();
    if (!obj) return null;
    return {
      id: String(fav._id),
      type: 'object',
      label: obj.labelPlural,
      href: `/objects/${obj.slug}`,
      icon: obj.icon,
      position: fav.position,
    };
  }
  if (fav.recordId) {
    const record = await Record.findOne({
      _id: fav.recordId,
      workspaceId: ctx.workspaceId,
      deletedAt: null,
    }).lean();
    if (!record) return null;
    const obj = await ObjectMetadata.findById(record.objectMetadataId).lean();
    const idField = obj?.labelIdentifierFieldId
      ? await FieldMetadata.findById(obj.labelIdentifierFieldId).lean()
      : null;
    const value = idField ? record.data?.[idField.name] : null;
    const label = idField ? getFieldType(idField.type).toSearchText(value, idField) : '';
    return {
      id: String(fav._id),
      type: 'record',
      label: label || '(sin nombre)',
      href: `/objects/${obj.slug}/${String(record._id)}`,
      icon: obj?.icon,
      position: fav.position,
    };
  }
  return null;
}

/** Lista los favoritos del usuario (resueltos), por posición. */
export async function listFavorites(ctx) {
  assertTenant(ctx);
  await connectToDatabase();
  const favs = await Favorite.find({ workspaceId: ctx.workspaceId, userId: ctx.userId })
    .sort({ position: 1 })
    .lean();
  const resolved = await Promise.all(favs.map((f) => resolveFavorite(ctx, f)));
  return resolved.filter(Boolean);
}

/** Añade un favorito (registro u objeto). Idempotente. */
export async function addFavorite(ctx, { recordId, objectMetadataId }) {
  assertTenant(ctx);
  await connectToDatabase();
  const key = recordId ? { recordId } : { objectMetadataId };
  const existing = await Favorite.findOne({
    workspaceId: ctx.workspaceId,
    userId: ctx.userId,
    ...key,
  });
  if (existing) throw new ConflictError('Ya está en favoritos');

  const count = await Favorite.countDocuments({ workspaceId: ctx.workspaceId, userId: ctx.userId });
  const doc = await Favorite.create({
    workspaceId: ctx.workspaceId,
    userId: ctx.userId,
    recordId: recordId ?? null,
    objectMetadataId: objectMetadataId ?? null,
    position: count,
  });
  return String(doc._id);
}

/** Quita un favorito. */
export async function removeFavorite(ctx, favoriteId) {
  assertTenant(ctx);
  await connectToDatabase();
  const fav = await Favorite.findOne({
    _id: favoriteId,
    workspaceId: ctx.workspaceId,
    userId: ctx.userId,
  });
  if (!fav) throw new NotFoundError('Favorito no encontrado');
  await fav.deleteOne();
}

/** Quita un favorito por su recurso (para el toggle desde la ficha). */
export async function removeFavoriteByTarget(ctx, { recordId, objectMetadataId }) {
  assertTenant(ctx);
  await connectToDatabase();
  const key = recordId ? { recordId } : { objectMetadataId };
  await Favorite.deleteOne({ workspaceId: ctx.workspaceId, userId: ctx.userId, ...key });
}

/** Reordena los favoritos según la lista de ids. */
export async function reorderFavorites(ctx, orderedIds) {
  assertTenant(ctx);
  await connectToDatabase();
  await Promise.all(
    orderedIds.map((id, i) =>
      Favorite.updateOne(
        { _id: id, workspaceId: ctx.workspaceId, userId: ctx.userId },
        { $set: { position: i } },
      ),
    ),
  );
}

/** ¿Está este recurso en favoritos? (para el estado del botón). */
export async function isFavorite(ctx, { recordId, objectMetadataId }) {
  assertTenant(ctx);
  await connectToDatabase();
  const key = recordId ? { recordId } : { objectMetadataId };
  const f = await Favorite.findOne({
    workspaceId: ctx.workspaceId,
    userId: ctx.userId,
    ...key,
  })
    .select('_id')
    .lean();
  return Boolean(f);
}
