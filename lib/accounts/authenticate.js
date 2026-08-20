import { connectToDatabase } from '@/lib/db/connect';
import { verifyPassword } from '@/lib/auth/password';
import { UnauthorizedError } from '@/lib/errors/domain-errors';
import { logSecurityEvent } from '@/lib/utils/logger';
import User from '@/models/User';
import WorkspaceMember from '@/models/WorkspaceMember';

/**
 * Hash señuelo (de una cadena aleatoria que nadie conoce) contra el que se
 * compara cuando la cuenta no existe.
 *
 * El mensaje de error ya era genérico, pero el **tiempo** delataba: sin usuario
 * no se ejecutaba bcrypt y la respuesta volvía en un par de milisegundos, frente
 * a los ~200 ms de una cuenta real. Eso convierte el login en un detector de
 * direcciones registradas, que es justo lo que el mensaje genérico evita.
 * Comparar contra el señuelo iguala el coste.
 */
const DECOY_HASH = '$2b$12$22m3Ul8t/3VEqK/bbRc2X.JDKFaSQ7RMXxGnenyas9sdIqr2w17Gi';

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
  const usable = user && user.passwordHash && !user.deletedAt;
  // El señuelo se compara igualmente: sin esto, la respuesta rápida delataría
  // que la dirección no está registrada.
  const ok = await verifyPassword(password, usable ? user.passwordHash : DECOY_HASH);
  if (!usable || !ok) {
    logSecurityEvent('login.failed', { email, reason: usable ? 'password' : 'no-account' });
    throw new UnauthorizedError('Email o contraseña incorrectos');
  }

  const membership = await WorkspaceMember.findOne({ userId: user._id })
    .sort({ joinedAt: 1 })
    .select('workspaceId')
    .lean();
  if (!membership) {
    logSecurityEvent('login.failed', { email, reason: 'no-workspace' });
    throw new UnauthorizedError('Tu cuenta no pertenece a ningún espacio de trabajo');
  }

  user.lastActiveAt = new Date();
  await user.save();

  return { userId: String(user._id), workspaceId: String(membership.workspaceId) };
}
