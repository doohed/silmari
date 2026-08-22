import { connectToDatabase } from '@/lib/db/connect';
import { assertTenant } from '@/lib/services/tenant';
import { NotFoundError } from '@/lib/errors/domain-errors';
import Notification from '@/models/Notification';
import User from '@/models/User';

const MAX_LIMIT = 30;

/** DTO de una notificación. `actorMap` (userId → { id, label, avatarUrl }) hidrata el autor. */
function toNotificationDTO(n, actorMap) {
  const actorId = n.actorId ? String(n.actorId) : null;
  return {
    id: String(n._id),
    type: n.type,
    title: n.title,
    body: n.body ?? '',
    entity: n.entity ? { kind: n.entity.kind, id: n.entity.id } : null,
    url: n.url ?? null,
    actor: actorId ? (actorMap?.get(actorId) ?? null) : null,
    readAt: n.readAt ?? null,
    createdAt: n.createdAt,
  };
}

/** Mapa userId → { id, label, avatarUrl } de los actores de una lista. */
async function actorMapFor(items) {
  const ids = new Set();
  for (const n of items) if (n.actorId) ids.add(String(n.actorId));
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

/**
 * Crea notificaciones para un conjunto de destinatarios. La inicia el sistema
 * (un suscriptor de eventos), no una acción de usuario, así que no consulta
 * `can`; igualmente queda acotada por `workspaceId`. Descarta destinatarios
 * inválidos y API keys (no tienen bandeja).
 *
 * `excludeActor` decide si el propio actor puede recibirla, y por defecto **no**:
 * en los avisos que nacen de un gesto consciente de usuario (`task.assigned`:
 * acabas de asignarte una tarea) notificarte a ti mismo es ruido. Las
 * automatizaciones lo desactivan a propósito, porque ahí los destinatarios los
 * fijó un ADMIN de antemano y quién toca el registro es circunstancial: «avísame
 * cuando entre un lead que cumpla X» sigue valiendo si el lead lo metes tú. Sin
 * esto, además, la acción `notify` es inútil en un workspace de una persona.
 * @param {{ workspaceId: string, userIds: string[], type: string, title: string,
 *   body?: string, entity?: {kind:string,id:string}|null, actorId?: string|null,
 *   url?: string|null, excludeActor?: boolean }} args
 */
export async function notifyUsers({
  workspaceId,
  userIds,
  type,
  title,
  body,
  entity,
  actorId,
  url,
  excludeActor = true,
}) {
  if (!workspaceId || !type || !title) return 0;
  const actor = String(actorId ?? '');
  const recipients = [...new Set((userIds ?? []).map(String))].filter(
    (id) => id && !id.startsWith('apikey:') && !(excludeActor && id === actor),
  );
  if (recipients.length === 0) return 0;
  await connectToDatabase();
  await Notification.insertMany(
    recipients.map((userId) => ({
      workspaceId,
      userId,
      type,
      title,
      body: body ?? '',
      entity: entity ?? null,
      actorId: actorId ?? null,
      url: url ?? null,
    })),
  );
  return recipients.length;
}

/**
 * Bandeja del usuario actual, más recientes primero.
 * @param {import('@/lib/auth/permissions').Ctx} ctx
 * @param {{ limit?: number }} [opts]
 */
export async function listNotifications(ctx, { limit = MAX_LIMIT } = {}) {
  assertTenant(ctx);
  await connectToDatabase();
  const items = await Notification.find({ workspaceId: ctx.workspaceId, userId: ctx.userId })
    .sort({ createdAt: -1 })
    .limit(Math.min(limit, MAX_LIMIT))
    .lean();
  const map = await actorMapFor(items);
  return items.map((n) => toNotificationDTO(n, map));
}

/** Nº de notificaciones sin leer del usuario actual. */
export async function unreadCount(ctx) {
  assertTenant(ctx);
  await connectToDatabase();
  return Notification.countDocuments({
    workspaceId: ctx.workspaceId,
    userId: ctx.userId,
    readAt: null,
  });
}

/** Marca una notificación como leída (idempotente). */
export async function markRead(ctx, id) {
  assertTenant(ctx);
  await connectToDatabase();
  const n = await Notification.findOne({
    _id: id,
    workspaceId: ctx.workspaceId,
    userId: ctx.userId,
  });
  if (!n) throw new NotFoundError('Notificación no encontrada');
  if (!n.readAt) {
    n.readAt = new Date();
    await n.save();
  }
  return toNotificationDTO(n, await actorMapFor([n]));
}

/** Marca todas las del usuario actual como leídas. */
export async function markAllRead(ctx) {
  assertTenant(ctx);
  await connectToDatabase();
  await Notification.updateMany(
    { workspaceId: ctx.workspaceId, userId: ctx.userId, readAt: null },
    { $set: { readAt: new Date() } },
  );
}
