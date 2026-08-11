import { connectToDatabase } from '@/lib/db/connect';
import { assertTenant } from '@/lib/services/tenant';
import { NotFoundError, ValidationError } from '@/lib/errors/domain-errors';
import { emitDomainEvent } from '@/lib/events';
import Activity from '@/models/Activity';
import User from '@/models/User';

/** Anuncia que a `recipientIds` se les asignó una tarea (el actor se excluye aguas abajo). */
function announceAssignment(ctx, doc, recipientIds) {
  if (!recipientIds || recipientIds.length === 0) return;
  emitDomainEvent(ctx, {
    type: 'task.assigned',
    payload: {
      taskId: String(doc._id),
      title: doc.title ?? '',
      dueAt: doc.dueAt ?? null,
      recipientIds,
    },
  });
}

/**
 * DTO de una actividad para el cliente. Si se pasa `assigneeMap`
 * (userId → { id, label, avatarUrl }), incluye `assignees` hidratados.
 */
export function toActivityDTO(a, assigneeMap) {
  const assigneeIds = (a.assigneeIds ?? []).map(String);
  return {
    id: String(a._id),
    type: a.type,
    title: a.title ?? '',
    body: a.body ?? null,
    status: a.status,
    dueAt: a.dueAt ?? null,
    assigneeIds,
    assignees: assigneeMap ? assigneeIds.map((id) => assigneeMap.get(id)).filter(Boolean) : [],
    authorId: a.authorId ? String(a.authorId) : null,
    completedAt: a.completedAt ?? null,
    targets: (a.targets ?? []).map((t) => ({
      objectMetadataId: String(t.objectMetadataId),
      recordId: String(t.recordId),
    })),
    createdAt: a.createdAt,
  };
}

/** Mapa userId → { id, label, avatarUrl } de los responsables de una lista. */
async function assigneeMapFor(items) {
  const ids = new Set();
  for (const a of items) for (const id of a.assigneeIds ?? []) ids.add(String(id));
  if (ids.size === 0) return new Map();
  const users = await User.find({ _id: { $in: [...ids] } })
    .select('firstName lastName avatarUrl')
    .lean();
  return new Map(
    users.map((u) => [
      String(u._id),
      {
        id: String(u._id),
        label: `${u.firstName} ${u.lastName ?? ''}`.trim(),
        avatarUrl: u.avatarUrl ?? null,
      },
    ]),
  );
}

function normalizeTargets(targets) {
  return (targets ?? [])
    .filter((t) => t?.objectMetadataId && t?.recordId)
    .map((t) => ({ objectMetadataId: t.objectMetadataId, recordId: t.recordId }));
}

/**
 * Crea una nota o tarea. Las notas deben vincularse a un registro; las tareas
 * pueden ser sueltas (sin registro) o vinculadas.
 * @param {import('@/lib/auth/permissions').Ctx} ctx
 * @param {{ type:'NOTE'|'TASK', title?:string, body?:any, status?:string, dueAt?:string, assigneeIds?:string[], targets?:Array }} input
 */
export async function createActivity(ctx, input) {
  assertTenant(ctx);
  await connectToDatabase();
  if (input.type !== 'NOTE' && input.type !== 'TASK') throw new ValidationError('Tipo no válido');
  const targets = normalizeTargets(input.targets);
  if (input.type === 'NOTE' && targets.length === 0) {
    throw new ValidationError('La nota debe vincularse a un registro');
  }

  // Responsables: los indicados; si no se indica ninguno, el creador (así la
  // tarea aparece en "Mías"). Las API keys no se autoasignan.
  const author = String(ctx.userId);
  const provided = Array.isArray(input.assigneeIds)
    ? input.assigneeIds.filter(Boolean).map(String)
    : null;
  const assigneeIds =
    input.type === 'TASK'
      ? provided && provided.length > 0
        ? provided
        : author.startsWith('apikey:')
          ? []
          : [author]
      : [];

  const doc = await Activity.create({
    workspaceId: ctx.workspaceId,
    type: input.type,
    title: input.title ?? '',
    body: input.type === 'NOTE' ? (input.body ?? null) : null,
    status: input.type === 'TASK' ? (input.status ?? 'TODO') : 'TODO',
    dueAt: input.dueAt ? new Date(input.dueAt) : null,
    assigneeIds,
    authorId: ctx.userId,
    targets,
  });
  if (doc.type === 'TASK') announceAssignment(ctx, doc, assigneeIds);
  const map = await assigneeMapFor([doc]);
  return toActivityDTO(doc, map);
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
  const map = await assigneeMapFor(items);
  return items.map((a) => toActivityDTO(a, map));
}

/**
 * Bandeja global de tareas con filtros. `from`/`to` acotan por fecha límite
 * (`dueAt`), para el calendario.
 * @param {import('@/lib/auth/permissions').Ctx} ctx
 * @param {{ scope?: 'all'|'mine'|'overdue', status?: string, from?: string, to?: string }} [opts]
 */
export async function listTasks(ctx, { scope = 'all', status, from, to } = {}) {
  assertTenant(ctx);
  await connectToDatabase();
  const query = { workspaceId: ctx.workspaceId, type: 'TASK', deletedAt: null };
  if (scope === 'mine') query.assigneeIds = ctx.userId;
  if (scope === 'overdue') {
    query.dueAt = { $lt: new Date() };
    query.status = { $ne: 'DONE' };
  }
  if (status) query.status = status;
  if (from || to) {
    query.dueAt = { ...(query.dueAt ?? {}) };
    if (from) query.dueAt.$gte = new Date(from);
    if (to) query.dueAt.$lt = new Date(to);
  }
  const items = await Activity.find(query).sort({ dueAt: 1, createdAt: -1 }).lean();
  const map = await assigneeMapFor(items);
  return items.map((a) => toActivityDTO(a, map));
}

async function loadActivity(ctx, id) {
  const a = await Activity.findOne({ _id: id, workspaceId: ctx.workspaceId, deletedAt: null });
  if (!a) throw new NotFoundError('Actividad no encontrada');
  return a;
}

/** Actualiza título/cuerpo/estado/vencimiento/responsables de una actividad. */
export async function updateActivity(ctx, id, patch) {
  assertTenant(ctx);
  await connectToDatabase();
  const a = await loadActivity(ctx, id);
  const prevAssignees = new Set((a.assigneeIds ?? []).map(String));
  for (const key of ['title', 'body', 'status', 'dueAt']) {
    if (patch[key] !== undefined)
      a[key] = key === 'dueAt' ? (patch[key] ? new Date(patch[key]) : null) : patch[key];
  }
  if (patch.assigneeIds !== undefined) {
    a.assigneeIds = Array.isArray(patch.assigneeIds) ? patch.assigneeIds : [];
  }
  if (patch.status === 'DONE') a.completedAt = new Date();
  if (patch.status && patch.status !== 'DONE') a.completedAt = null;
  await a.save();
  if (patch.assigneeIds !== undefined) {
    const added = (a.assigneeIds ?? []).map(String).filter((uid) => !prevAssignees.has(uid));
    if (a.type === 'TASK') announceAssignment(ctx, a, added);
  }
  const map = await assigneeMapFor([a]);
  return toActivityDTO(a, map);
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
  const map = await assigneeMapFor([a]);
  return toActivityDTO(a, map);
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
  const map = await assigneeMapFor([a]);
  return toActivityDTO(a, map);
}

/** Borra (soft) una actividad. */
export async function deleteActivity(ctx, id) {
  assertTenant(ctx);
  await connectToDatabase();
  const a = await loadActivity(ctx, id);
  a.deletedAt = new Date();
  await a.save();
}
