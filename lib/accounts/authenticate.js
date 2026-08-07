import { connectToDatabase } from '@/lib/db/connect';
import { verifyPassword } from '@/lib/auth/password';
import { UnauthorizedError } from '@/lib/errors/domain-errors';
import User from '@/models/User';
import WorkspaceMember from '@/models/WorkspaceMember';

/**
 * Verifica credenciales y resuelve el workspace activo por defecto (el primero
 * al que se unió el usuario). Mensaje de error genérico para no filtrar si el
 * email existe.
 * @param {{ email: string, password: string }} input
 * @returns {Promise<{ userId: string, workspaceId: string }>}
 */
export async function authenticate({ email, password }) {
  await connectToDatabase();

  const user = await User.findOne({ email }).select('passwordHash deletedAt');
  // Cuenta OAuth sin contraseña o cuenta borrada: nunca autentican por contraseña.
  const ok =
    user && user.passwordHash && !user.deletedAt
      ? await verifyPassword(password, user.passwordHash)
      : false;
  if (!user || !ok) {
    throw new UnauthorizedError('Email o contraseña incorrectos');
  }

  const membership = await WorkspaceMember.findOne({ userId: user._id })
    .sort({ joinedAt: 1 })
    .select('workspaceId')
    .lean();
  if (!membership) {
    throw new UnauthorizedError('Tu cuenta no pertenece a ningún espacio de trabajo');
  }

  user.lastActiveAt = new Date();
  await user.save();

  return { userId: String(user._id), workspaceId: String(membership.workspaceId) };
}
