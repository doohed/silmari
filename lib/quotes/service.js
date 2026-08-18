import { connectToDatabase } from '@/lib/db/connect';
import { assertTenant } from '@/lib/services/tenant';
import { getObjectBySlug } from '@/lib/metadata/object-service';
import { getFieldType } from '@/lib/field-types';
import { escapeRegex } from '@/lib/field-types/helpers';
import Record from '@/models/Record';
import FieldMetadata from '@/models/FieldMetadata';

/** Tipos que pueden actuar como campo de precio de un producto. */
export const PRICE_FIELD_TYPES = ['CURRENCY', 'NUMBER'];

/** Lee el precio numérico de un valor según el tipo del campo. */
function priceOf(field, value) {
  if (value == null) return 0;
  if (field?.type === 'CURRENCY') return Number(value?.amount) || 0;
  return Number(value) || 0;
}

/**
 * Busca productos de un objeto-catálogo por su searchText. Devuelve la etiqueta
 * (labelIdentifier) y el precio (del campo configurado). Alimenta el selector de
 * producto de las líneas (LINE_ITEMS).
 * @param {import('@/lib/auth/permissions').Ctx} ctx
 * @param {{ objectSlug: string, priceFieldName?: string, q?: string, limit?: number }} args
 */
export async function searchProducts(ctx, { objectSlug, priceFieldName, q = '', limit = 20 }) {
  assertTenant(ctx);
  if (!objectSlug) return [];
  const object = await getObjectBySlug(ctx, objectSlug); // lanza NotFoundError si no existe
  const idField = object.fields.find((f) => f.id === object.labelIdentifierFieldId);
  const priceField = priceFieldName ? object.fields.find((f) => f.name === priceFieldName) : null;

  await connectToDatabase();
  const match = { workspaceId: ctx.workspaceId, objectMetadataId: object.id, deletedAt: null };
  if (q) match.searchText = new RegExp(escapeRegex(q), 'i');
  const records = await Record.find(match).limit(Math.min(limit, 50)).lean();

  return records.map((r) => {
    const labelVal = idField ? r.data?.[idField.name] : null;
    const label = idField ? getFieldType(idField.type).toSearchText(labelVal, idField) : '';
    return {
      id: String(r._id),
      label: label || '(sin nombre)',
      price: priceField ? priceOf(priceField, r.data?.[priceField.name]) : 0,
    };
  });
}

/**
 * Campos de precio (CURRENCY/NUMBER) de un objeto, para configurar el catálogo
 * de un campo LINE_ITEMS.
 * @param {import('@/lib/auth/permissions').Ctx} ctx
 * @param {{ objectMetadataId: string }} args
 */
export async function listPriceFields(ctx, { objectMetadataId }) {
  assertTenant(ctx);
  await connectToDatabase();
  const fields = await FieldMetadata.find({
    workspaceId: ctx.workspaceId,
    objectMetadataId,
    type: { $in: PRICE_FIELD_TYPES },
    deletedAt: null,
    isActive: true,
  })
    .select('name label')
    .lean();
  return fields.map((f) => ({ name: f.name, label: f.label }));
}
