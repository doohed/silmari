import { connectToDatabase } from '@/lib/db/connect';
import { assertTenant } from '@/lib/services/tenant';
import { NotFoundError, ValidationError } from '@/lib/errors/domain-errors';
import Activity from '@/models/Activity';

/** DTO de una actividad para el cliente. */
export function toActivityDTO(a) {
  return {
    id: String(a._id),
    type: a.type,
    title: a.title ?? '',
    body: a.body ?? null,
    status: a.status,
    dueAt: a.dueAt ?? null,
    assigneeId: a.assigneeId ? String(a.assigneeId) : null,
    authorId: a.authorId ? String(a.authorId) : null,
    completedAt: a.completedAt ?? null,
    targets: (a.targets ?? []).map((t) => ({
      objectMetadataId: String(t.objectMetadataId),
      recordId: String(t.recordId),
    })),
    createdAt: a.createdAt,
  };
}

function normalizeTargets(targets) {
  return (targets ?? [])
    .filter((t) => t?.objectMetadataId && t?.recordId)
    .map((t) => ({ objectMetadataId: t.objectMetadataId, recordId: t.recordId }));
}

/**
 * Crea una nota o tarea vinculada a uno o varios registros.
 * @param {import('@/lib/auth/permissions').Ctx} ctx
 * @param {{ type:'NOTE'|'TASK', title?:string, body?:any, status?:string, dueAt?:string, targets:Array }} input
 */
export async function createActivity(ctx, input) {
  assertTenant(ctx);
  await connectToDatabase();
  const targets = normalizeTargets(input.targets);
  if (targets.length === 0) throw new ValidationError('La actividad debe vincularse a un registro');
  if (input.type !== 'NOTE' && input.type !== 'TASK') throw new ValidationError('Tipo no válido');

  const doc = await Activity.create({
    workspaceId: ctx.workspaceId,
    type: input.type,
    title: input.title ?? '',
    body: input.type === 'NOTE' ? (input.body ?? null) : null,
    status: input.type === 'TASK' ? (input.status ?? 'TODO') : 'TODO',
    dueAt: input.dueAt ? new Date(input.dueAt) : null,
    assigneeId: input.type === 'TASK' ? ctx.userId : null,
    authorId: ctx.userId,
    targets,
  });
  return toActivityDTO(doc);
}

/**
 * Actividades vinculadas a un registro.
 * @param {import('@/lib/auth/permissions').Ctx} ctx
 * @param {{ recordId: string, type?: 'NOTE'|'TASK' }} args
 */
export async function listForRecord(ctx, { recordId, type }) {
  assertTenant(ctx);
  await connectToDatabase();
  const query = { workspaceId: ctx.workspaceId, 'targets.recordId': recordId, deletedAt: null };
  if (type) query.type = type;
  const items = await Activity.find(query).sort({ createdAt: -1 }).lean();
  return items.map(toActivityDTO);
}

/**
 * Bandeja global de tareas con filtros.
 * @param {import('@/lib/auth/permissions').Ctx} ctx
 * @param {{ scope?: 'all'|'mine'|'overdue', status?: string }} [opts]
 */
export async function listTasks(ctx, { scope = 'all', status } = {}) {
  assertTenant(ctx);
  await connectToDatabase();
  const query = { workspaceId: ctx.workspaceId, type: 'TASK', deletedAt: null };
  if (scope === 'mine') query.assigneeId = ctx.userId;
  if (scope === 'overdue') {
    query.dueAt = { $lt: new Date() };
    query.status = { $ne: 'DONE' };
  }
  if (status) query.status = status;
  const items = await Activity.find(query).sort({ dueAt: 1, createdAt: -1 }).lean();
  return items.map(toActivityDTO);
}

async function loadActivity(ctx, id) {
  const a = await Activity.findOne({ _id: id, workspaceId: ctx.workspaceId, deletedAt: null });
  if (!a) throw new NotFoundError('Actividad no encontrada');
  return a;
}

/** Actualiza título/cuerpo/estado/vencimiento de una actividad. */
export async function updateActivity(ctx, id, patch) {
  assertTenant(ctx);
  await connectToDatabase();
  const a = await loadActivity(ctx, id);
  for (const key of ['title', 'body', 'status', 'dueAt']) {
    if (patch[key] !== undefined)
      a[key] = key === 'dueAt' ? (patch[key] ? new Date(patch[key]) : null) : patch[key];
  }
  if (patch.status === 'DONE') a.completedAt = new Date();
  if (patch.status && patch.status !== 'DONE') a.completedAt = null;
  await a.save();
  return toActivityDTO(a);
}

/** Marca/desmarca una tarea como hecha. */
export async function toggleTask(ctx, id) {
  assertTenant(ctx);
  await connectToDatabase();
  const a = await loadActivity(ctx, id);
  if (a.status === 'DONE') {
    a.status = 'TODO';
    a.completedAt = null;
  } else {
    a.status = 'DONE';
    a.completedAt = new Date();
  }
  await a.save();
  return toActivityDTO(a);
}

/** Añade un registro a los targets de una actividad. */
export async function addTarget(ctx, id, { objectMetadataId, recordId }) {
  assertTenant(ctx);
  await connectToDatabase();
  const a = await loadActivity(ctx, id);
  if (!a.targets.some((t) => String(t.recordId) === String(recordId))) {
    a.targets.push({ objectMetadataId, recordId });
    await a.save();
  }
  return toActivityDTO(a);
}

/** Borra (soft) una actividad. */
export async function deleteActivity(ctx, id) {
  assertTenant(ctx);
  await connectToDatabase();
  const a = await loadActivity(ctx, id);
  a.deletedAt = new Date();
  await a.save();
}
