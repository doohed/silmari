import { connectToDatabase } from '@/lib/db/connect';
import { assertTenant } from '@/lib/services/tenant';
import { getFieldType } from '@/lib/field-types';
import { escapeRegex } from '@/lib/field-types/helpers';
import RecordRelation from '@/models/RecordRelation';
import FieldMetadata from '@/models/FieldMetadata';
import ObjectMetadata from '@/models/ObjectMetadata';
import Record from '@/models/Record';

/**
 * Campos RELATION propietarios (MANY_TO_ONE) de un objeto: el id del destino
 * vive en `data`, y lo espejamos en recordRelations para el inverso.
 * @param {Array<object>} fields
 */
export function owningRelationFields(fields) {
  return fields.filter((f) => f.type === 'RELATION' && f.relation?.type === 'MANY_TO_ONE');
}

/**
 * Sincroniza las aristas de recordRelations de un registro según su `data`.
 * @param {import('@/lib/auth/permissions').Ctx} ctx
 * @param {{ recordId: any, data: object, fields: Array<object> }} args
 * @param {{ session?: import('mongoose').ClientSession }} [opts]
 */
export async function syncRecordRelations(ctx, { recordId, data, fields }, { session } = {}) {
  const relFields = owningRelationFields(fields);
  if (relFields.length === 0) return;
  await connectToDatabase();

  for (const field of relFields) {
    await RecordRelation.deleteMany(
      { workspaceId: ctx.workspaceId, fieldMetadataId: field.id, sourceRecordId: recordId },
      { session },
    );
    const targetId = data?.[field.name];
    if (targetId) {
      await RecordRelation.create(
        [
          {
            workspaceId: ctx.workspaceId,
            fieldMetadataId: field.id,
            sourceRecordId: recordId,
            targetRecordId: targetId,
          },
        ],
        { session },
      );
    }
  }
}

/**
 * Elimina todas las aristas de un registro (al borrarlo definitivamente).
 * @param {import('@/lib/auth/permissions').Ctx} ctx
 * @param {any} recordId
 * @param {{ session?: import('mongoose').ClientSession }} [opts]
 */
export async function removeRecordRelations(ctx, recordId, { session } = {}) {
  await connectToDatabase();
  await RecordRelation.deleteMany(
    {
      workspaceId: ctx.workspaceId,
      $or: [{ sourceRecordId: recordId }, { targetRecordId: recordId }],
    },
    { session },
  );
}

/** Label identificador de un registro dado el objeto destino. */
async function identifierFieldOf(objectMetadataId) {
  const obj = await ObjectMetadata.findById(objectMetadataId)
    .select('labelIdentifierFieldId')
    .lean();
  return obj?.labelIdentifierFieldId
    ? await FieldMetadata.findById(obj.labelIdentifierFieldId).lean()
    : null;
}

function labelOfRecord(record, identifierField) {
  if (!identifierField) return '(sin nombre)';
  const value = record.data?.[identifierField.name];
  return getFieldType(identifierField.type).toSearchText(value, identifierField) || '(sin nombre)';
}

/**
 * Relaciones INVERSAS de un registro: los objetos cuyos campos RELATION
 * (MANY_TO_ONE) apuntan a este objeto (p. ej. contactos/oportunidades de una
 * empresa). Devuelve una sección por campo entrante, con los registros ya
 * vinculados y los datos para vincular/crear más.
 * @param {import('@/lib/auth/permissions').Ctx} ctx
 * @param {{ objectMetadataId: string, recordId: string }} args
 */
export async function getRelatedRecords(ctx, { objectMetadataId, recordId }) {
  assertTenant(ctx);
  await connectToDatabase();

  const incoming = await FieldMetadata.find({
    workspaceId: ctx.workspaceId,
    type: 'RELATION',
    'relation.type': 'MANY_TO_ONE',
    'relation.targetObjectMetadataId': objectMetadataId,
    deletedAt: null,
    isActive: true,
  }).lean();

  const sections = [];
  for (const field of incoming) {
    const sourceObject = await ObjectMetadata.findById(field.objectMetadataId)
      .select('slug labelSingular labelPlural')
      .lean();
    if (!sourceObject) continue;

    const edges = await RecordRelation.find({
      workspaceId: ctx.workspaceId,
      fieldMetadataId: field._id,
      targetRecordId: recordId,
    })
      .select('sourceRecordId')
      .lean();

    const sourceIds = edges.map((e) => e.sourceRecordId);
    const identifierField = await identifierFieldOf(field.objectMetadataId);
    const records =
      sourceIds.length > 0
        ? await Record.find({ _id: { $in: sourceIds }, deletedAt: null }).lean()
        : [];

    sections.push({
      fieldMetadataId: String(field._id),
      fieldName: field.name,
      fieldLabel: field.label,
      sourceObject: {
        slug: sourceObject.slug,
        labelSingular: sourceObject.labelSingular,
        labelPlural: sourceObject.labelPlural,
        identifierName: identifierField?.name ?? null,
        identifierType: identifierField?.type ?? null,
      },
      records: records.map((r) => ({
        id: String(r._id),
        label: labelOfRecord(r, identifierField),
      })),
    });
  }

  return sections;
}

/**
 * Busca registros candidatos para un campo RELATION (por su searchText).
 * Devuelve `{ id, label }` usando el labelIdentifier del objeto destino.
 * @param {import('@/lib/auth/permissions').Ctx} ctx
 * @param {{ fieldMetadataId: string, q?: string, limit?: number }} args
 */
export async function searchRelationOptions(ctx, { fieldMetadataId, q = '', limit = 20 }) {
  assertTenant(ctx);
  await connectToDatabase();

  const field = await FieldMetadata.findOne({
    _id: fieldMetadataId,
    workspaceId: ctx.workspaceId,
  }).lean();
  if (!field || field.type !== 'RELATION') return [];

  const targetObjectId = field.relation?.targetObjectMetadataId;
  const object = await ObjectMetadata.findById(targetObjectId)
    .select('labelIdentifierFieldId')
    .lean();
  const identifierField = object?.labelIdentifierFieldId
    ? await FieldMetadata.findById(object.labelIdentifierFieldId).lean()
    : null;

  const match = { workspaceId: ctx.workspaceId, objectMetadataId: targetObjectId, deletedAt: null };
  if (q) match.searchText = new RegExp(escapeRegex(q), 'i');

  const records = await Record.find(match).limit(limit).lean();
  return records.map((r) => {
    const value = identifierField ? r.data?.[identifierField.name] : null;
    const label = identifierField
      ? getFieldType(identifierField.type).toSearchText(value, identifierField)
      : '';
    return { id: String(r._id), label: label || '(sin nombre)' };
  });
}
