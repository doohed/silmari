import { connectToDatabase } from '@/lib/db/connect';
import { can } from '@/lib/auth/permissions';
import { assertTenant } from '@/lib/services/tenant';
import { ForbiddenError, NotFoundError, ValidationError } from '@/lib/errors/domain-errors';
import { createInvitation } from '@/lib/invitations/service';
import WorkspaceMember from '@/models/WorkspaceMember';

/**
 * Lista los miembros del workspace actual (siempre filtrado por `ctx.workspaceId`).
 * @param {import('@/lib/auth/permissions').Ctx} ctx
 * @returns {Promise<Array<{ userId: string, role: string, name: string, email: string, joinedAt: Date }>>}
 */
export async function listMembers(ctx) {
  assertTenant(ctx);
  if (!can(ctx, 'members:read')) throw new ForbiddenError();
  await connectToDatabase();

  const members = await WorkspaceMember.find({ workspaceId: ctx.workspaceId })
    .populate({ path: 'userId', select: 'firstName lastName email avatarUrl' })
    .sort({ joinedAt: 1 })
    .lean();

  return members
    .filter((m) => m.userId)
    .map((m) => ({
      userId: String(m.userId._id),
      role: m.role,
      name: `${m.userId.firstName} ${m.userId.lastName}`.trim(),
      email: m.userId.email,
      avatarUrl: m.userId.avatarUrl ?? null,
      joinedAt: m.joinedAt,
    }));
}

/**
 * Invita a un miembro. Devuelve el enlace de aceptación (en dev no hay email).
 * @param {import('@/lib/auth/permissions').Ctx} ctx
 * @param {{ email: string, role: 'ADMIN'|'MEMBER' }} input
 * @returns {Promise<{ token: string }>}
 */
export async function inviteMember(ctx, { email, role }) {
  // La autorización fina la aplica createInvitation (members:invite).
  return createInvitation(ctx, { email, role });
}

/**
 * Elimina a un miembro del workspace. No permite eliminar OWNERs ni a uno mismo.
 * @param {import('@/lib/auth/permissions').Ctx} ctx
 * @param {string} targetUserId
 * @returns {Promise<void>}
 */
export async function removeMember(ctx, targetUserId) {
  assertTenant(ctx);
  if (!can(ctx, 'members:remove')) throw new ForbiddenError('No puedes eliminar miembros');
  if (targetUserId === ctx.userId) {
    throw new ValidationError('No puedes eliminarte a ti mismo');
  }
  await connectToDatabase();

  const target = await WorkspaceMember.findOne({
    workspaceId: ctx.workspaceId,
    userId: targetUserId,
  });
  if (!target) throw new NotFoundError('Miembro no encontrado');
  if (target.role === 'OWNER') {
    throw new ForbiddenError('No se puede eliminar al propietario');
  }

  await target.deleteOne();
}
