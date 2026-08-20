import { connectToDatabase } from '@/lib/db/connect';
import { assertTenant } from '@/lib/services/tenant';
import { hashPassword, verifyPassword } from '@/lib/auth/password';
import { invalidatePendingResets } from '@/lib/accounts/password-reset';
import { NotFoundError, ValidationError } from '@/lib/errors/domain-errors';
import User from '@/models/User';
import WorkspaceMember from '@/models/WorkspaceMember';

/**
 * Actualiza el perfil del usuario actual.
 * @param {import('@/lib/auth/permissions').Ctx} ctx
 * @param {{ firstName?: string, lastName?: string, avatarUrl?: string }} patch
 */
export async function updateProfile(ctx, patch) {
  assertTenant(ctx);
  await connectToDatabase();
  const user = await User.findById(ctx.userId);
  if (!user) throw new NotFoundError('Usuario no encontrado');
  for (const key of ['firstName', 'lastName', 'avatarUrl']) {
    if (patch[key] !== undefined) user[key] = patch[key];
  }
  await user.save();
  return {
    id: String(user._id),
    firstName: user.firstName,
    lastName: user.lastName,
    email: user.email,
    avatarUrl: user.avatarUrl ?? null,
  };
}

/**
 * Datos de la cuenta para la página de perfil (incluye si tiene contraseña, para
 * decidir entre "cambiar" o "establecer").
 * @param {import('@/lib/auth/permissions').Ctx} ctx
 */
export async function getAccountProfile(ctx) {
  assertTenant(ctx);
  await connectToDatabase();
  const user = await User.findById(ctx.userId)
    .select('email firstName lastName avatarUrl authProvider passwordHash')
    .lean();
  if (!user) throw new NotFoundError('Usuario no encontrado');
  return {
    id: String(user._id),
    email: user.email,
    firstName: user.firstName,
    lastName: user.lastName ?? '',
    avatarUrl: user.avatarUrl ?? null,
    authProvider: user.authProvider ?? 'email',
    hasPassword: Boolean(user.passwordHash),
  };
}

/**
 * Cambia o establece la contraseña. Si la cuenta ya tiene contraseña, exige la
 * actual; las cuentas OAuth (sin contraseña) pueden establecer una por primera vez.
 * @param {import('@/lib/auth/permissions').Ctx} ctx
 * @param {{ currentPassword?: string, newPassword: string }} input
 */
export async function changePassword(ctx, { currentPassword, newPassword }) {
  assertTenant(ctx);
  await connectToDatabase();
  const user = await User.findById(ctx.userId).select('passwordHash');
  if (!user) throw new NotFoundError('Usuario no encontrado');

  if (user.passwordHash) {
    if (!currentPassword) {
      throw new ValidationError('Introduce tu contraseña actual', {
        fieldErrors: { currentPassword: ['Introduce tu contraseña actual'] },
      });
    }
    const ok = await verifyPassword(currentPassword, user.passwordHash);
    if (!ok) {
      throw new ValidationError('La contraseña actual no es correcta', {
        fieldErrors: { currentPassword: ['La contraseña actual no es correcta'] },
      });
    }
  }

  user.passwordHash = await hashPassword(newPassword);
  // Cambiar la contraseña echa a todas las sesiones abiertas. Es el sentido de
  // cambiarla cuando sospechas que te han entrado: sin esto, la sesión del otro
  // seguiría viva hasta siete días. Quien la cambia desde Ajustes se queda
  // dentro porque la acción le re-emite la cookie justo después.
  user.sessionsValidFrom = new Date();
  await user.save();
  // Si había un enlace de recuperación pendiente, deja de servir: cambiar la
  // contraseña a mano invalida cualquier enlace que estuviera en un buzón.
  await invalidatePendingResets(ctx.userId);
  return { ok: true };
}

/**
 * Borra (soft) la cuenta del usuario y revoca su acceso quitando sus
 * pertenencias a workspaces. No cascada el borrado de datos del workspace.
 * @param {import('@/lib/auth/permissions').Ctx} ctx
 */
export async function deleteAccount(ctx) {
  assertTenant(ctx);
  await connectToDatabase();
  const user = await User.findById(ctx.userId);
  if (!user) throw new NotFoundError('Usuario no encontrado');
  user.deletedAt = new Date();
  await user.save();
  await WorkspaceMember.deleteMany({ userId: ctx.userId });
  return { ok: true };
}
