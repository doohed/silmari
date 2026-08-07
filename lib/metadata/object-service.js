import mongoose from 'mongoose';
import { connectToDatabase } from '@/lib/db/connect';
import { can } from '@/lib/auth/permissions';
import { assertTenant } from '@/lib/services/tenant';
import { parseOrThrow } from '@/lib/validation/zod-helpers';
import { createObjectSchema, updateObjectSchema } from '@/lib/validation/metadata';
import { isCamelCase, isReservedObjectSlug } from '@/lib/metadata/reserved';
import { slugify } from '@/lib/utils/slugify';
import { createField, listFields } from '@/lib/metadata/field-service';
import { syncFieldIndex } from '@/lib/db/indexes';
import {
  ConflictError,
  ForbiddenError,
  NotFoundError,
  ValidationError,
} from '@/lib/errors/domain-errors';
import ObjectMetadata from '@/models/ObjectMetadata';

/** DTO de un objeto para la UI/servicios. */
export function toObjectDTO(o) {
  return {
    id: String(o._id),
    nameSingular: o.nameSingular,
    namePlural: o.namePlural,
    slug: o.slug,
    labelSingular: o.labelSingular,
    labelPlural: o.labelPlural,
    description: o.description ?? '',
    icon: o.icon ?? 'Circle',
    isCustom: o.isCustom,
    isActive: o.isActive,
    labelIdentifierFieldId: o.labelIdentifierFieldId ? String(o.labelIdentifierFieldId) : null,
    position: o.position,
  };
}

/**
 * Lista los objetos activos del workspace (para la navegación).
 * @param {import('@/lib/auth/permissions').Ctx} ctx
 * @param {{ includeInactive?: boolean }} [opts]
 */
export async function listObjects(ctx, { includeInactive = false } = {}) {
  assertTenant(ctx);
  await connectToDatabase();
  const query = { workspaceId: ctx.workspaceId, deletedAt: null };
  if (!includeInactive) query.isActive = true;
  const objects = await ObjectMetadata.find(query).sort({ position: 1, createdAt: 1 }).lean();
  return objects.map(toObjectDTO);
}

/**
 * Objeto por slug, con sus campos hidratados.
 * @param {import('@/lib/auth/permissions').Ctx} ctx
 * @param {string} slug
 */
export async function getObjectBySlug(ctx, slug) {
  assertTenant(ctx);
  await connectToDatabase();
  const object = await ObjectMetadata.findOne({
    workspaceId: ctx.workspaceId,
    slug,
    deletedAt: null,
  }).lean();
  if (!object) throw new NotFoundError('Objeto no encontrado');
  const fields = await listFields(ctx, String(object._id));
  return { ...toObjectDTO(object), fields };
}

/**
 * Objeto por id, con sus campos.
 * @param {import('@/lib/auth/permissions').Ctx} ctx
 * @param {string} id
 */
export async function getObjectById(ctx, id) {
  assertTenant(ctx);
  await connectToDatabase();
  const object = await ObjectMetadata.findOne({
    _id: id,
    workspaceId: ctx.workspaceId,
    deletedAt: null,
  }).lean();
  if (!object) throw new NotFoundError('Objeto no encontrado');
  const fields = await listFields(ctx, String(object._id));
  return { ...toObjectDTO(object), fields };
}

async function nextObjectPosition(ctx, session) {
  const last = await ObjectMetadata.findOne({ workspaceId: ctx.workspaceId })
    .sort({ position: -1 })
    .select('position')
    .session(session ?? null)
    .lean();
  return (last?.position ?? -1) + 1;
}

/**
 * Crea un objeto custom + su campo identificador por defecto (`name` TEXT), en
 * una transacción. Devuelve el objeto con sus campos.
 * @param {import('@/lib/auth/permissions').Ctx} ctx
 * @param {object} input createObjectSchema
 */
export async function createObject(ctx, input) {
  assertTenant(ctx);
  if (!can(ctx, 'dataModel:manage'))
    throw new ForbiddenError('No puedes modificar el modelo de datos');
  await connectToDatabase();

  const data = parseOrThrow(createObjectSchema, input);
  const nameSingular = data.nameSingular;
  const namePlural = data.namePlural ?? `${nameSingular}s`;
  if (!isCamelCase(nameSingular) || !isCamelCase(namePlural)) {
    throw new ValidationError('Los nombres del objeto deben ser camelCase', {
      fieldErrors: { nameSingular: ['Usa camelCase, p. ej. "producto"'] },
    });
  }
  const slug = data.slug ?? slugify(namePlural);
  if (!slug) throw new ValidationError('No se pudo derivar un slug válido');
  if (isReservedObjectSlug(slug)) {
    throw new ValidationError(`"${slug}" es un slug reservado`, {
      fieldErrors: { slug: ['Slug reservado'] },
    });
  }

  const labelSingular = data.labelSingular;
  const labelPlural = data.labelPlural ?? labelSingular;

  const session = await mongoose.startSession();
  let objectId;
  try {
    await session.withTransaction(async () => {
      const position = await nextObjectPosition(ctx, session);
      const [object] = await ObjectMetadata.create(
        [
          {
            workspaceId: ctx.workspaceId,
            nameSingular,
            namePlural,
            slug,
            labelSingular,
            labelPlural,
            description: data.description ?? '',
            icon: data.icon ?? 'Circle',
            isCustom: true,
            isActive: true,
            position,
          },
        ],
        { session },
      );

      // Campo identificador por defecto. Indexado: es la columna por la que más
      // se ordena; el índice `fld_name` es compartido por nombre de campo.
      const nameField = await createField(
        ctx,
        {
          objectMetadataId: object._id,
          name: 'name',
          label: 'Nombre',
          type: 'TEXT',
          isNullable: false,
          isIndexed: true,
        },
        { session, syncIndex: false },
      );

      object.labelIdentifierFieldId = nameField.id;
      await object.save({ session });
      objectId = String(object._id);
    });
  } catch (err) {
    if (err?.code === 11000) {
      throw new ConflictError(`Ya existe un objeto con el slug "${slug}"`, {
        fieldErrors: { slug: ['Ya existe un objeto con este slug'] },
      });
    }
    throw err;
  } finally {
    await session.endSession();
  }

  // El índice del identificador se crea tras el commit (Mongo no crea índices en
  // transacción). Idempotente: `fld_name` es compartido y suele existir ya.
  await syncFieldIndex({ name: 'name', isIndexed: true });

  return getObjectById(ctx, objectId);
}

/**
 * Actualiza etiquetas/estado de un objeto.
 * @param {import('@/lib/auth/permissions').Ctx} ctx
 * @param {string} id
 * @param {object} input updateObjectSchema
 */
export async function updateObject(ctx, id, input) {
  assertTenant(ctx);
  if (!can(ctx, 'dataModel:manage'))
    throw new ForbiddenError('No puedes modificar el modelo de datos');
  await connectToDatabase();

  const data = parseOrThrow(updateObjectSchema, input);
  const object = await ObjectMetadata.findOne({
    _id: id,
    workspaceId: ctx.workspaceId,
    deletedAt: null,
  });
  if (!object) throw new NotFoundError('Objeto no encontrado');

  for (const key of ['labelSingular', 'labelPlural', 'description', 'icon', 'isActive']) {
    if (data[key] !== undefined) object[key] = data[key];
  }
  await object.save();
  return toObjectDTO(object);
}

/**
 * Borra (soft) un objeto custom. Los objetos estándar no se pueden borrar.
 * @param {import('@/lib/auth/permissions').Ctx} ctx
 * @param {string} id
 */
export async function deleteObject(ctx, id) {
  assertTenant(ctx);
  if (!can(ctx, 'dataModel:manage'))
    throw new ForbiddenError('No puedes modificar el modelo de datos');
  await connectToDatabase();

  const object = await ObjectMetadata.findOne({
    _id: id,
    workspaceId: ctx.workspaceId,
    deletedAt: null,
  });
  if (!object) throw new NotFoundError('Objeto no encontrado');
  if (!object.isCustom) throw new ForbiddenError('No se pueden borrar los objetos estándar');

  object.deletedAt = new Date();
  object.isActive = false;
  await object.save();
}
