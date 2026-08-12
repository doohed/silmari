import { randomUUID } from 'node:crypto';
import { connectToDatabase } from '@/lib/db/connect';
import { can } from '@/lib/auth/permissions';
import { assertTenant } from '@/lib/services/tenant';
import { parseOrThrow } from '@/lib/validation/zod-helpers';
import { createFieldSchema, updateFieldSchema } from '@/lib/validation/metadata';
import { getFieldType, isValidFieldType } from '@/lib/field-types';
import { parseFormula, formulaDependencies } from '@/lib/field-types/formula-eval';
import { ROLLUP_OPERATIONS } from '@/lib/field-types/rollup-eval';
import { isCamelCase, isReservedFieldName } from '@/lib/metadata/reserved';
import { syncFieldIndex, dropFieldIndex, fieldNeedsIndex } from '@/lib/db/indexes';
import { slugify } from '@/lib/utils/slugify';
import {
  ConflictError,
  ForbiddenError,
  NotFoundError,
  ValidationError,
} from '@/lib/errors/domain-errors';
import ObjectMetadata from '@/models/ObjectMetadata';
import FieldMetadata from '@/models/FieldMetadata';
import Record from '@/models/Record';

/** DTO de un campo para la UI/servicios. */
export function toFieldDTO(f) {
  return {
    id: String(f._id),
    objectMetadataId: String(f.objectMetadataId),
    name: f.name,
    label: f.label,
    type: f.type,
    icon: f.icon ?? null,
    isNullable: f.isNullable,
    isUnique: f.isUnique,
    isIndexed: f.isIndexed,
    isCustom: f.isCustom,
    isSystem: f.isSystem,
    isActive: f.isActive,
    defaultValue: f.defaultValue ?? null,
    position: f.position,
    settings: f.settings ?? {},
    options: f.options ?? undefined,
    relation: f.relation
      ? {
          type: f.relation.type,
          targetObjectMetadataId: f.relation.targetObjectMetadataId
            ? String(f.relation.targetObjectMetadataId)
            : null,
          targetFieldName: f.relation.targetFieldName ?? null,
          onDelete: f.relation.onDelete ?? 'SET_NULL',
        }
      : undefined,
  };
}

/** Normaliza las opciones de SELECT/MULTI_SELECT (id/value/color/position). */
function normalizeOptions(options = []) {
  return options.map((o, i) => ({
    id: o.id ?? randomUUID(),
    label: o.label,
    value: o.value ?? (slugify(o.label) || `opcion-${i + 1}`),
    color: o.color ?? 'gray',
    position: o.position ?? i,
  }));
}

/** Valida coherencia semántica según el tipo. */
/** Tipos numéricos que una fórmula puede referenciar. */
const NUMERIC_TYPES = new Set(['NUMBER', 'PERCENT', 'RATING', 'CURRENCY']);

async function validateTypeSpecifics(ctx, { type, options, relation, settings, objectMetadataId }, session) {
  if ((type === 'SELECT' || type === 'MULTI_SELECT') && (!options || options.length === 0)) {
    throw new ValidationError(`El tipo ${type} requiere al menos una opción`, {
      fieldErrors: { options: ['Añade al menos una opción'] },
    });
  }
  if (type === 'RELATION') {
    if (!relation?.type || !relation?.targetObjectMetadataId) {
      throw new ValidationError('El tipo RELATION requiere configuración de relación');
    }
    const target = await ObjectMetadata.findOne({
      _id: relation.targetObjectMetadataId,
      workspaceId: ctx.workspaceId,
      deletedAt: null,
    })
      .select('_id')
      .session(session ?? null)
      .lean();
    if (!target) throw new ValidationError('El objeto destino de la relación no existe');
  }
  if (type === 'FORMULA') {
    const src = settings?.formula;
    if (!src || !String(src).trim()) {
      throw new ValidationError('El tipo FORMULA requiere una fórmula', {
        fieldErrors: { formula: ['Escribe una fórmula, p. ej. amount * probability / 100'] },
      });
    }
    let deps;
    try {
      deps = formulaDependencies(src); // parsea y extrae dependencias (lanza si es inválida)
    } catch (err) {
      throw new ValidationError(`Fórmula no válida: ${err.message}`, {
        fieldErrors: { formula: [err.message] },
      });
    }
    // Cada dependencia debe existir en el objeto y ser numérica (sin fórmulas
    // anidadas, para no depender del orden de cálculo).
    const siblings = await FieldMetadata.find({
      workspaceId: ctx.workspaceId,
      objectMetadataId,
      deletedAt: null,
    })
      .select('name type')
      .session(session ?? null)
      .lean();
    const byName = new Map(siblings.map((f) => [f.name, f.type]));
    for (const dep of deps) {
      const depType = byName.get(dep);
      if (!depType) {
        throw new ValidationError(`La fórmula referencia un campo inexistente: "${dep}"`, {
          fieldErrors: { formula: [`El campo "${dep}" no existe`] },
        });
      }
      if (!NUMERIC_TYPES.has(depType)) {
        throw new ValidationError(`La fórmula solo admite campos numéricos: "${dep}" no lo es`, {
          fieldErrors: { formula: [`"${dep}" no es un campo numérico`] },
        });
      }
    }
    // Normaliza la fórmula guardada (parseada de nuevo para asegurar validez).
    parseFormula(src);
  }
  if (type === 'ROLLUP') {
    const cfg = settings?.rollup;
    if (!cfg?.relationFieldId || !cfg?.operation) {
      throw new ValidationError('El tipo ROLLUP requiere una relación y una operación', {
        fieldErrors: { rollup: ['Elige la relación entrante y la operación'] },
      });
    }
    if (!ROLLUP_OPERATIONS.includes(cfg.operation)) {
      throw new ValidationError(`Operación de ROLLUP no válida: "${cfg.operation}"`);
    }
    // La relación debe ser un MANY_TO_ONE de OTRO objeto cuyo destino sea este.
    const relField = await FieldMetadata.findOne({
      _id: cfg.relationFieldId,
      workspaceId: ctx.workspaceId,
      type: 'RELATION',
      deletedAt: null,
    })
      .session(session ?? null)
      .lean();
    if (!relField || String(relField.relation?.targetObjectMetadataId) !== String(objectMetadataId)) {
      throw new ValidationError('La relación del ROLLUP debe apuntar a este objeto', {
        fieldErrors: { rollup: ['Elige una relación entrante válida'] },
      });
    }
    // Salvo `count`, hace falta un campo numérico del objeto de origen.
    if (cfg.operation !== 'count') {
      if (!cfg.aggregateFieldName) {
        throw new ValidationError('Elige el campo numérico a agregar', {
          fieldErrors: { rollup: ['Elige un campo numérico a agregar'] },
        });
      }
      const aggField = await FieldMetadata.findOne({
        workspaceId: ctx.workspaceId,
        objectMetadataId: relField.objectMetadataId,
        name: cfg.aggregateFieldName,
        deletedAt: null,
      })
        .session(session ?? null)
        .lean();
      if (!aggField) {
        throw new ValidationError(`El campo "${cfg.aggregateFieldName}" no existe en el objeto de origen`);
      }
      if (!NUMERIC_TYPES.has(aggField.type)) {
        throw new ValidationError(`"${cfg.aggregateFieldName}" no es un campo numérico`);
      }
    }
  }
  if (type === 'LINE_ITEMS') {
    // El catálogo de productos es OPCIONAL: si se configura, el objeto debe
    // existir y el campo de precio (si se indica) ser CURRENCY/NUMBER.
    const cfg = settings?.lineItems;
    if (cfg?.productObjectSlug) {
      const catalog = await ObjectMetadata.findOne({
        workspaceId: ctx.workspaceId,
        slug: cfg.productObjectSlug,
        deletedAt: null,
      })
        .session(session ?? null)
        .lean();
      if (!catalog) throw new ValidationError('El objeto de catálogo no existe');
      if (cfg.priceFieldName) {
        const priceField = await FieldMetadata.findOne({
          workspaceId: ctx.workspaceId,
          objectMetadataId: catalog._id,
          name: cfg.priceFieldName,
          deletedAt: null,
        })
          .session(session ?? null)
          .lean();
        if (!priceField || !['CURRENCY', 'NUMBER'].includes(priceField.type)) {
          throw new ValidationError('El campo de precio debe ser de tipo moneda o número');
        }
      }
    }
  }
}

/**
 * Crea un campo en un objeto.
 * @param {import('@/lib/auth/permissions').Ctx} ctx
 * @param {object} input incluye objectMetadataId + campos de createFieldSchema
 * @param {{ session?: import('mongoose').ClientSession, syncIndex?: boolean }} [opts]
 */
export async function createField(ctx, input, { session, syncIndex = true } = {}) {
  assertTenant(ctx);
  if (!can(ctx, 'dataModel:manage'))
    throw new ForbiddenError('No puedes modificar el modelo de datos');
  await connectToDatabase();

  const { objectMetadataId } = input;
  if (!objectMetadataId) throw new ValidationError('Falta el objeto del campo');
  const data = parseOrThrow(createFieldSchema, input);

  if (!isCamelCase(data.name)) {
    throw new ValidationError('El nombre del campo debe ser camelCase', {
      fieldErrors: { name: ['Usa camelCase, p. ej. "fechaCierre"'] },
    });
  }
  if (isReservedFieldName(data.name)) {
    throw new ValidationError(`"${data.name}" es un nombre reservado`, {
      fieldErrors: { name: ['Nombre reservado'] },
    });
  }
  if (!isValidFieldType(data.type)) throw new ValidationError('Tipo de campo no válido');

  const object = await ObjectMetadata.findOne({
    _id: objectMetadataId,
    workspaceId: ctx.workspaceId,
    deletedAt: null,
  }).session(session ?? null);
  if (!object) throw new NotFoundError('Objeto no encontrado');

  await validateTypeSpecifics(ctx, { ...data, objectMetadataId }, session);

  const doc = {
    workspaceId: ctx.workspaceId,
    objectMetadataId,
    name: data.name,
    label: data.label,
    description: data.description ?? '',
    type: data.type,
    icon: data.icon ?? null,
    isNullable: data.isNullable ?? true,
    isUnique: data.isUnique ?? false,
    isIndexed: data.isIndexed ?? false,
    isCustom: true,
    isSystem: false,
    defaultValue: data.defaultValue ?? null,
    settings: data.settings ?? {},
    options:
      data.type === 'SELECT' || data.type === 'MULTI_SELECT'
        ? normalizeOptions(data.options)
        : undefined,
    relation: data.type === 'RELATION' ? data.relation : undefined,
    position: await nextFieldPosition(ctx, objectMetadataId, session),
  };

  let field;
  try {
    [field] = await FieldMetadata.create([doc], { session });
  } catch (err) {
    if (err?.code === 11000) {
      throw new ConflictError(`Ya existe un campo "${data.name}" en este objeto`, {
        fieldErrors: { name: ['Ya existe un campo con este nombre'] },
      });
    }
    throw err;
  }

  // Los índices no se crean dentro de transacción (Mongo no lo permite).
  if (syncIndex && !session && fieldNeedsIndex(field)) {
    await syncFieldIndex(field);
  }

  return toFieldDTO(field);
}

async function nextFieldPosition(ctx, objectMetadataId, session) {
  const last = await FieldMetadata.findOne({ workspaceId: ctx.workspaceId, objectMetadataId })
    .sort({ position: -1 })
    .select('position')
    .session(session ?? null)
    .lean();
  return (last?.position ?? -1) + 1;
}

/**
 * Lista los campos activos de un objeto, por posición.
 * @param {import('@/lib/auth/permissions').Ctx} ctx
 * @param {string} objectMetadataId
 */
export async function listFields(ctx, objectMetadataId) {
  assertTenant(ctx);
  await connectToDatabase();
  const fields = await FieldMetadata.find({
    workspaceId: ctx.workspaceId,
    objectMetadataId,
    deletedAt: null,
  })
    .sort({ position: 1 })
    .lean();
  return fields.map(toFieldDTO);
}

/**
 * Actualiza un campo. El cambio de tipo se permite solo si los datos existentes
 * validan contra el nuevo tipo; si no, se bloquea con mensaje claro.
 */
export async function updateField(ctx, fieldId, input) {
  assertTenant(ctx);
  if (!can(ctx, 'dataModel:manage'))
    throw new ForbiddenError('No puedes modificar el modelo de datos');
  await connectToDatabase();

  const data = parseOrThrow(updateFieldSchema, input);
  const field = await FieldMetadata.findOne({
    _id: fieldId,
    workspaceId: ctx.workspaceId,
    deletedAt: null,
  });
  if (!field) throw new NotFoundError('Campo no encontrado');

  if (data.type && data.type !== field.type) {
    await assertTypeChangeSafe(ctx, field, data.type);
    field.type = data.type;
  }

  for (const key of [
    'label',
    'description',
    'icon',
    'isNullable',
    'isIndexed',
    'isActive',
    'defaultValue',
    'settings',
  ]) {
    if (data[key] !== undefined) field[key] = data[key];
  }
  if (data.options && (field.type === 'SELECT' || field.type === 'MULTI_SELECT')) {
    field.options = normalizeOptions(data.options);
  }

  await field.save();
  // Al activar el índice, lo aseguramos (compartido por nombre de campo). Al
  // desactivarlo no se borra: el índice es compartido y queda inocuo si no se usa.
  if (fieldNeedsIndex(field)) await syncFieldIndex(field);
  return toFieldDTO(field);
}

/** Bloquea el cambio de tipo si algún dato existente no valida con el nuevo tipo. */
async function assertTypeChangeSafe(ctx, field, newType) {
  const path = `data.${field.name}`;
  const withValue = await Record.find({
    workspaceId: ctx.workspaceId,
    objectMetadataId: field.objectMetadataId,
    deletedAt: null,
    [path]: { $exists: true, $ne: null },
  })
    .select(path)
    .lean();

  if (withValue.length === 0) return; // sin datos: cambio libre

  const schema = getFieldType(newType).schema({ isNullable: true });
  const invalid = withValue.some((r) => !schema.safeParse(r.data?.[field.name]).success);
  if (invalid) {
    throw new ConflictError(
      `No se puede cambiar el tipo a ${newType}: hay registros cuyos valores no son compatibles. ` +
        'Vacía o corrige esos valores antes de cambiar el tipo.',
    );
  }
}

/**
 * Borra (soft) un campo. No permite borrar campos de sistema ni el identificador.
 */
export async function deleteField(ctx, fieldId) {
  assertTenant(ctx);
  if (!can(ctx, 'dataModel:manage'))
    throw new ForbiddenError('No puedes modificar el modelo de datos');
  await connectToDatabase();

  const field = await FieldMetadata.findOne({
    _id: fieldId,
    workspaceId: ctx.workspaceId,
    deletedAt: null,
  });
  if (!field) throw new NotFoundError('Campo no encontrado');
  if (field.isSystem) throw new ForbiddenError('No se puede borrar un campo de sistema');

  const object = await ObjectMetadata.findById(field.objectMetadataId).select(
    'labelIdentifierFieldId',
  );
  if (object && String(object.labelIdentifierFieldId) === String(field._id)) {
    throw new ForbiddenError('No se puede borrar el campo identificador del objeto');
  }

  field.deletedAt = new Date();
  field.isActive = false;
  await field.save();
  await dropFieldIndex(field);
}
