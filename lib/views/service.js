import { connectToDatabase } from '@/lib/db/connect';
import { assertTenant } from '@/lib/services/tenant';
import { ForbiddenError, NotFoundError, ValidationError } from '@/lib/errors/domain-errors';
import { getObjectBySlug } from '@/lib/metadata/object-service';
import View from '@/models/View';

/** DTO de una vista para el cliente. */
export function toViewDTO(v) {
  return {
    id: String(v._id),
    objectMetadataId: String(v.objectMetadataId),
    name: v.name,
    type: v.type,
    icon: v.icon,
    isDefault: v.isDefault,
    position: v.position,
    kanbanFieldMetadataId: v.kanbanFieldMetadataId ? String(v.kanbanFieldMetadataId) : null,
    viewFields: (v.viewFields ?? []).map((f) => ({
      fieldMetadataId: String(f.fieldMetadataId),
      isVisible: f.isVisible,
      position: f.position,
      size: f.size,
    })),
    viewFilters: (v.viewFilters ?? []).map((f) => ({
      fieldMetadataId: String(f.fieldMetadataId),
      operator: f.operator,
      value: f.value,
    })),
    viewSorts: (v.viewSorts ?? []).map((s) => ({
      fieldMetadataId: String(s.fieldMetadataId),
      direction: s.direction,
    })),
  };
}

/** Construye los viewFields por defecto a partir de los campos del objeto. */
function defaultViewFields(fields) {
  return fields.map((f, i) => ({
    fieldMetadataId: f.id,
    isVisible: true,
    position: i,
    size: i === 0 ? 240 : 180,
  }));
}

/**
 * Añade a `viewFields` los campos del objeto que la vista todavía no conoce
 * (campos creados después de ella) como columnas visibles al final. Devuelve
 * `null` si no hay nada que añadir.
 * @param {Array<object>} viewFields
 * @param {Array<object>} fields
 */
function withMissingFields(viewFields = [], fields) {
  const known = new Set(viewFields.map((vf) => String(vf.fieldMetadataId)));
  const missing = fields.filter((f) => !known.has(f.id));
  if (missing.length === 0) return null;

  let position = viewFields.reduce((max, vf) => Math.max(max, vf.position ?? 0), -1) + 1;
  return [
    ...viewFields,
    ...missing.map((f) => ({
      fieldMetadataId: f.id,
      isVisible: true,
      position: position++,
      size: 180,
    })),
  ];
}

/**
 * Sincroniza las vistas con los campos actuales del objeto. Los campos ocultos
 * siguen en `viewFields` con `isVisible: false`, así que no se re-muestran.
 * @param {import('@/lib/auth/permissions').Ctx} ctx
 * @param {Array<object>} views documentos lean
 * @param {Array<object>} fields
 */
async function syncViewFields(ctx, views, fields) {
  for (const view of views) {
    const next = withMissingFields(view.viewFields ?? [], fields);
    if (!next) continue;
    view.viewFields = next;
    await View.updateOne(
      { _id: view._id, workspaceId: ctx.workspaceId },
      { $set: { viewFields: next } },
    );
  }
  return views;
}

/** Primer campo SELECT activo (candidato a agrupación kanban). */
function firstSelectField(fields) {
  return fields.find((f) => f.type === 'SELECT' && f.isActive !== false);
}

/**
 * Devuelve el objeto + todas sus vistas, asegurando una vista TABLE por defecto
 * y —para objetos con un campo SELECT— una vista KANBAN agrupada por él.
 * @param {import('@/lib/auth/permissions').Ctx} ctx
 * @param {string} objectSlug
 * @returns {Promise<{ object: object, views: object[] }>}
 */
export async function getObjectViews(ctx, objectSlug) {
  assertTenant(ctx);
  const object = await getObjectBySlug(ctx, objectSlug);
  await connectToDatabase();

  let views = await View.find({
    workspaceId: ctx.workspaceId,
    objectMetadataId: object.id,
    deletedAt: null,
  })
    .sort({ position: 1, createdAt: 1 })
    .lean();

  if (views.length === 0) {
    const created = await View.create({
      workspaceId: ctx.workspaceId,
      objectMetadataId: object.id,
      name: 'Todos',
      type: 'TABLE',
      icon: 'Table',
      isDefault: true,
      position: 0,
      viewFields: defaultViewFields(object.fields),
    });
    views = [created.toObject()];
  }

  const select = firstSelectField(object.fields);
  if (select && !views.some((v) => v.type === 'KANBAN')) {
    const kanban = await View.create({
      workspaceId: ctx.workspaceId,
      objectMetadataId: object.id,
      name: 'Kanban',
      type: 'KANBAN',
      icon: 'Columns',
      isDefault: false,
      position: views.length,
      kanbanFieldMetadataId: select.id,
      viewFields: defaultViewFields(object.fields),
    });
    views.push(kanban.toObject());
  }

  await syncViewFields(ctx, views, object.fields);
  return { object, views: views.map(toViewDTO) };
}

/**
 * Devuelve la vista tabla por defecto de un objeto (la crea si no existe).
 * @param {import('@/lib/auth/permissions').Ctx} ctx
 * @param {string} objectSlug
 * @returns {Promise<{ object: object, view: object, views: object[] }>}
 */
export async function getOrCreateDefaultView(ctx, objectSlug) {
  assertTenant(ctx);
  const object = await getObjectBySlug(ctx, objectSlug);
  await connectToDatabase();

  let views = await View.find({
    workspaceId: ctx.workspaceId,
    objectMetadataId: object.id,
    deletedAt: null,
  })
    .sort({ position: 1, createdAt: 1 })
    .lean();

  if (views.length === 0) {
    const created = await View.create({
      workspaceId: ctx.workspaceId,
      objectMetadataId: object.id,
      name: 'Todos',
      type: 'TABLE',
      isDefault: true,
      position: 0,
      viewFields: defaultViewFields(object.fields),
    });
    views = [created.toObject()];
  }

  await syncViewFields(ctx, views, object.fields);
  const def = views.find((v) => v.isDefault) ?? views[0];
  return { object, view: toViewDTO(def), views: views.map(toViewDTO) };
}

/** Lista las vistas de un objeto. */
export async function listViews(ctx, objectMetadataId) {
  assertTenant(ctx);
  await connectToDatabase();
  const views = await View.find({
    workspaceId: ctx.workspaceId,
    objectMetadataId,
    deletedAt: null,
  })
    .sort({ position: 1, createdAt: 1 })
    .lean();
  return views.map(toViewDTO);
}

async function loadView(ctx, viewId) {
  const view = await View.findOne({ _id: viewId, workspaceId: ctx.workspaceId, deletedAt: null });
  if (!view) throw new NotFoundError('Vista no encontrada');
  return view;
}

/**
 * Actualiza campos de una vista (columnas, filtros, orden, nombre).
 * @param {import('@/lib/auth/permissions').Ctx} ctx
 * @param {string} viewId
 * @param {object} patch
 */
export async function updateView(ctx, viewId, patch) {
  assertTenant(ctx);
  await connectToDatabase();
  const view = await loadView(ctx, viewId);

  for (const key of ['name', 'viewFields', 'viewFilters', 'viewSorts', 'kanbanFieldMetadataId']) {
    if (patch[key] !== undefined) view[key] = patch[key];
  }
  await view.save();
  return toViewDTO(view);
}

/** Crea una vista (para "Nueva vista" / duplicar). */
export async function createView(ctx, { objectMetadataId, name, type = 'TABLE', from } = {}) {
  assertTenant(ctx);
  if (!name) throw new ValidationError('La vista necesita un nombre');
  await connectToDatabase();

  const source = from ? await loadView(ctx, from) : null;
  const count = await View.countDocuments({ workspaceId: ctx.workspaceId, objectMetadataId });

  const view = await View.create({
    workspaceId: ctx.workspaceId,
    objectMetadataId,
    name,
    type: source?.type ?? type,
    isDefault: false,
    position: count,
    viewFields: source?.viewFields ?? [],
    viewFilters: source?.viewFilters ?? [],
    viewSorts: source?.viewSorts ?? [],
    kanbanFieldMetadataId: source?.kanbanFieldMetadataId ?? null,
  });
  return toViewDTO(view);
}

/** Borra (soft) una vista. No permite borrar la vista por defecto. */
export async function deleteView(ctx, viewId) {
  assertTenant(ctx);
  await connectToDatabase();
  const view = await loadView(ctx, viewId);
  if (view.isDefault) throw new ForbiddenError('No se puede borrar la vista por defecto');
  view.deletedAt = new Date();
  await view.save();
}
