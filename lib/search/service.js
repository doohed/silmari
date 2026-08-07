import { connectToDatabase } from '@/lib/db/connect';
import { assertTenant } from '@/lib/services/tenant';
import { getFieldType } from '@/lib/field-types';
import { escapeRegex } from '@/lib/field-types/helpers';
import ObjectMetadata from '@/models/ObjectMetadata';
import FieldMetadata from '@/models/FieldMetadata';
import Record from '@/models/Record';

/**
 * Búsqueda global sobre `records.searchText` (regex parcial, case-insensitive),
 * con resultados agrupados por objeto. Siempre acotada al workspace del ctx.
 * @param {import('@/lib/auth/permissions').Ctx} ctx
 * @param {{ q: string, limitPerObject?: number }} args
 * @returns {Promise<Array<{ object: object, records: Array<{ id:string, label:string }> }>>}
 */
export async function searchAll(ctx, { q, limitPerObject = 5 }) {
  assertTenant(ctx);
  const query = String(q ?? '').trim();
  if (!query) return [];
  await connectToDatabase();

  const rx = new RegExp(escapeRegex(query), 'i');
  const objects = await ObjectMetadata.find({
    workspaceId: ctx.workspaceId,
    deletedAt: null,
    isActive: true,
  })
    .sort({ position: 1 })
    .lean();

  const groups = [];
  for (const object of objects) {
    const idField = object.labelIdentifierFieldId
      ? await FieldMetadata.findById(object.labelIdentifierFieldId).lean()
      : null;

    const records = await Record.find({
      workspaceId: ctx.workspaceId,
      objectMetadataId: object._id,
      deletedAt: null,
      searchText: rx,
    })
      .limit(limitPerObject)
      .lean();

    if (records.length === 0) continue;

    groups.push({
      object: {
        id: String(object._id),
        slug: object.slug,
        labelSingular: object.labelSingular,
        labelPlural: object.labelPlural,
        icon: object.icon,
      },
      records: records.map((r) => {
        const value = idField ? r.data?.[idField.name] : null;
        const label = idField ? getFieldType(idField.type).toSearchText(value, idField) : '';
        return { id: String(r._id), label: label || '(sin nombre)' };
      }),
    });
  }

  return groups;
}
