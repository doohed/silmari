import { connectToDatabase } from '@/lib/db/connect';
import { assertTenant } from '@/lib/services/tenant';
import { NotFoundError, ValidationError } from '@/lib/errors/domain-errors';
import UserNote from '@/models/UserNote';

/** DTO de un apunte para el cliente. */
export function toUserNoteDTO(n) {
  return {
    id: String(n._id),
    title: n.title ?? '',
    body: n.body ?? null,
    pinned: Boolean(n.pinned),
    updatedAt: n.updatedAt,
    createdAt: n.createdAt,
  };
}

/**
 * Lista los apuntes del usuario actual (privados, no borrados).
 * @param {import('@/lib/auth/permissions').Ctx} ctx
 */
export async function listUserNotes(ctx) {
  assertTenant(ctx);
  await connectToDatabase();
  const items = await UserNote.find({
    workspaceId: ctx.workspaceId,
    userId: ctx.userId,
    deletedAt: null,
  })
    .sort({ pinned: -1, updatedAt: -1 })
    .lean();
  return items.map(toUserNoteDTO);
}

/**
 * Crea un apunte personal.
 * @param {import('@/lib/auth/permissions').Ctx} ctx
 * @param {{ title?: string, body?: any }} input
 */
export async function createUserNote(ctx, { title = '', body = null } = {}) {
  assertTenant(ctx);
  await connectToDatabase();
  const doc = await UserNote.create({
    workspaceId: ctx.workspaceId,
    userId: ctx.userId,
    title: title.trim(),
    body,
  });
  return toUserNoteDTO(doc);
}

/** Carga un apunte del usuario (o lanza). */
async function loadUserNote(ctx, id) {
  const n = await UserNote.findOne({
    _id: id,
    workspaceId: ctx.workspaceId,
    userId: ctx.userId,
    deletedAt: null,
  });
  if (!n) throw new NotFoundError('Apunte no encontrado');
  return n;
}

/**
 * Actualiza título, cuerpo o fijado de un apunte.
 * @param {import('@/lib/auth/permissions').Ctx} ctx
 * @param {string} id
 * @param {{ title?: string, body?: any, pinned?: boolean }} patch
 */
export async function updateUserNote(ctx, id, patch = {}) {
  assertTenant(ctx);
  if (!id) throw new ValidationError('Apunte no válido');
  await connectToDatabase();
  const n = await loadUserNote(ctx, id);
  if (patch.title !== undefined) n.title = String(patch.title).trim();
  if (patch.body !== undefined) n.body = patch.body;
  if (patch.pinned !== undefined) n.pinned = Boolean(patch.pinned);
  await n.save();
  return toUserNoteDTO(n);
}

/** Borra (soft) un apunte. */
export async function deleteUserNote(ctx, id) {
  assertTenant(ctx);
  if (!id) throw new ValidationError('Apunte no válido');
  await connectToDatabase();
  const n = await loadUserNote(ctx, id);
  n.deletedAt = new Date();
  await n.save();
}
