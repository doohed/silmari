'use server';

import { getContext } from '@/lib/auth/dal';
import { toActionError } from '@/lib/errors/to-response';
import {
  listRecords,
  createRecord,
  updateRecord,
  bulkUpdateRecords,
  softDeleteRecord,
  getRecord,
  searchRecords,
  moveRecord,
  reorderRecords,
  columnAggregates,
  listBoardColumn,
  restoreRecord,
  listAllTrash,
  hardDeleteRecord,
  exportRecords,
  importRecords,
  assertBulkSize,
} from '@/lib/records/service';
import { updateView, createView, deleteView } from '@/lib/views/service';
import { listObjects } from '@/lib/metadata/object-service';
import { searchRelationOptions, getRelatedRecords } from '@/lib/relations/service';
import { searchProducts } from '@/lib/quotes/service';
import { listTimelineReadable } from '@/lib/timeline/readable';
import {
  createActivity,
  listForRecord as listActivitiesForRecord,
  listTasks,
  updateActivity,
  toggleTask,
  addTarget,
  deleteActivity,
  logCommunication,
} from '@/lib/activities/service';
import { sendEmail } from '@/lib/email/service';
import { sendWhatsapp } from '@/lib/whatsapp/service';
import { listTemplatesForCompose, renderForRecord } from '@/lib/templates/service';
import {
  listForRecord as listAttachmentsForRecord,
  deleteAttachment,
} from '@/lib/attachments/service';
import { searchAll } from '@/lib/search/service';
import { listMembers } from '@/lib/members/service';
import {
  listFavorites,
  addFavorite,
  removeFavoriteByTarget,
  reorderFavorites,
  isFavorite,
} from '@/lib/favorites/service';

/**
 * Ejecuta `fn(ctx)` con el contexto de sesión y devuelve un resultado
 * discriminado `{ ok, data } | { ok:false, ... }` para TanStack Query.
 * @param {(ctx: import('@/lib/auth/permissions').Ctx) => Promise<any>} fn
 */
async function withCtx(fn) {
  const ctx = await getContext();
  if (!ctx) return { ok: false, message: 'Sesión no válida', code: 'UNAUTHORIZED' };
  try {
    return { ok: true, data: await fn(ctx) };
  } catch (err) {
    return toActionError(err);
  }
}

/** Lista registros (paginado por cursor) para la tabla. */
export async function listRecordsAction(input) {
  return withCtx((ctx) => listRecords(ctx, input));
}

/** Crea un registro. */
export async function createRecordAction(input) {
  return withCtx((ctx) => createRecord(ctx, { ...input, source: 'MANUAL' }));
}

/** Actualiza un registro (edición inline). */
export async function updateRecordAction(input) {
  return withCtx((ctx) => updateRecord(ctx, input));
}

/** Borra (soft) un registro. */
export async function deleteRecordAction(input) {
  return withCtx((ctx) => softDeleteRecord(ctx, input));
}

/** Borrado masivo. Mismo tope que el resto de operaciones por lotes. */
export async function bulkDeleteAction({ objectSlug, recordIds }) {
  return withCtx(async (ctx) => {
    const ids = assertBulkSize(recordIds);
    for (const recordId of ids) {
      await softDeleteRecord(ctx, { objectSlug, recordId });
    }
    return { deleted: ids.length };
  });
}

/** Edición masiva: fija un campo en los registros seleccionados. */
export async function bulkUpdateAction({ objectSlug, recordIds, fieldName, value }) {
  return withCtx((ctx) => bulkUpdateRecords(ctx, { objectSlug, recordIds, fieldName, value }));
}

/** Actualiza la configuración de una vista (columnas, filtros, orden, nombre). */
export async function updateViewAction({ viewId, patch }) {
  return withCtx((ctx) => updateView(ctx, viewId, patch));
}

/** Crea o duplica una vista. */
export async function createViewAction(input) {
  return withCtx((ctx) => createView(ctx, input));
}

/** Borra una vista. */
export async function deleteViewAction({ viewId }) {
  return withCtx((ctx) => deleteView(ctx, viewId));
}

/** Busca opciones para un campo RELATION. */
export async function searchRelationOptionsAction(input) {
  return withCtx((ctx) => searchRelationOptions(ctx, input));
}

/** Busca productos del catálogo para el selector de una línea (LINE_ITEMS). */
export async function searchProductsAction(input) {
  return withCtx((ctx) => searchProducts(ctx, input));
}

/** Miembros del workspace para el picker de campos MEMBER. */
export async function listMemberOptionsAction() {
  return withCtx(async (ctx) => {
    const members = await listMembers(ctx);
    return members.map((m) => ({ id: m.userId, label: m.name || m.email, avatarUrl: m.avatarUrl }));
  });
}

/** Un registro hidratado (ficha). */
export async function getRecordAction(input) {
  return withCtx((ctx) => getRecord(ctx, input));
}

/** Timeline legible de un registro. */
export async function getTimelineAction(input) {
  return withCtx((ctx) => listTimelineReadable(ctx, input));
}

/** Relaciones inversas de un registro (sección "Relacionados"). */
export async function getRelatedAction(input) {
  return withCtx((ctx) => getRelatedRecords(ctx, input));
}

/** Busca registros de un objeto (picker de vinculación). */
export async function searchRecordsAction(input) {
  return withCtx((ctx) => searchRecords(ctx, input));
}

/** Mueve un registro en el kanban (grupo y/o posición). */
export async function moveRecordAction(input) {
  return withCtx((ctx) => moveRecord(ctx, input));
}

/** Reordena en bloque (arrastrar con orden de columna activo → orden manual). */
export async function reorderRecordsAction(input) {
  return withCtx((ctx) => reorderRecords(ctx, input));
}

/** Agregados por columna kanban (conteo + suma). */
export async function columnAggregatesAction(input) {
  return withCtx((ctx) => columnAggregates(ctx, input));
}

/** Lista una columna del kanban (carga perezosa). */
export async function listBoardColumnAction(input) {
  return withCtx((ctx) => listBoardColumn(ctx, input));
}

// --- Papelera, import/export ---
export async function listTrashAction() {
  return withCtx((ctx) => listAllTrash(ctx));
}
export async function restoreRecordAction(input) {
  return withCtx((ctx) => restoreRecord(ctx, input));
}
export async function hardDeleteRecordAction(input) {
  return withCtx((ctx) => hardDeleteRecord(ctx, input));
}
export async function exportRecordsAction(input) {
  return withCtx((ctx) => exportRecords(ctx, input));
}
export async function importRecordsAction(input) {
  return withCtx((ctx) => importRecords(ctx, input));
}

// --- Actividades (notas y tareas) ---

export async function createActivityAction(input) {
  return withCtx((ctx) => createActivity(ctx, input));
}
export async function listActivitiesAction(input) {
  return withCtx((ctx) => listActivitiesForRecord(ctx, input));
}
export async function updateActivityAction({ id, patch }) {
  return withCtx((ctx) => updateActivity(ctx, id, patch));
}
export async function toggleTaskAction({ id }) {
  return withCtx((ctx) => toggleTask(ctx, id));
}
export async function addActivityTargetAction({ id, target }) {
  return withCtx((ctx) => addTarget(ctx, id, target));
}
export async function deleteActivityAction({ id }) {
  return withCtx((ctx) => deleteActivity(ctx, id));
}
export async function listTasksAction(input) {
  return withCtx((ctx) => listTasks(ctx, input));
}

// --- Comunicaciones (email / WhatsApp) ---

/** Historial de comunicaciones (email + WhatsApp) de un registro. */
export async function listCommunicationsAction({ recordId }) {
  return withCtx((ctx) => listActivitiesForRecord(ctx, { recordId, type: ['EMAIL', 'WHATSAPP'] }));
}
/** Registra una comunicación (enviada o recibida) sin enviarla por un proveedor. */
export async function logCommunicationAction(input) {
  return withCtx((ctx) => logCommunication(ctx, input));
}
/** Envía un email (lanza aviso claro si no hay cuenta conectada). */
export async function sendEmailAction(input) {
  return withCtx((ctx) => sendEmail(ctx, input));
}
/** Envía un WhatsApp (lanza aviso claro si no hay número conectado). */
export async function sendWhatsappAction(input) {
  return withCtx((ctx) => sendWhatsapp(ctx, input));
}
/** Plantillas disponibles para redactar (solo lectura). */
export async function listComposeTemplatesAction({ channel } = {}) {
  return withCtx((ctx) => listTemplatesForCompose(ctx, { channel }));
}
/** Renderiza una plantilla contra un registro (para rellenar el redactor). */
export async function renderTemplateAction(input) {
  return withCtx((ctx) => renderForRecord(ctx, input));
}

// --- Adjuntos ---

export async function listAttachmentsAction(input) {
  return withCtx((ctx) => listAttachmentsForRecord(ctx, input));
}

/** Lista los objetos del workspace (selector de vinculación). */
export async function listObjectsAction() {
  return withCtx((ctx) => listObjects(ctx));
}

// --- Búsqueda global ---

export async function searchAllAction(input) {
  return withCtx((ctx) => searchAll(ctx, input));
}

// --- Favoritos ---

export async function listFavoritesAction() {
  return withCtx((ctx) => listFavorites(ctx));
}
export async function addFavoriteAction(input) {
  return withCtx((ctx) => addFavorite(ctx, input));
}
export async function removeFavoriteAction(input) {
  return withCtx((ctx) => removeFavoriteByTarget(ctx, input));
}
export async function reorderFavoritesAction({ orderedIds }) {
  return withCtx((ctx) => reorderFavorites(ctx, orderedIds));
}
export async function isFavoriteAction(input) {
  return withCtx((ctx) => isFavorite(ctx, input));
}
export async function deleteAttachmentAction({ id }) {
  return withCtx((ctx) => deleteAttachment(ctx, id));
}
