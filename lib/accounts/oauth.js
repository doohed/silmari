import { connectToDatabase } from '@/lib/db/connect';
import { provisionAccount } from '@/lib/accounts/signup';
import { logger } from '@/lib/utils/logger';
import User from '@/models/User';
import WorkspaceMember from '@/models/WorkspaceMember';

/**
 * Inicia sesión o aprovisiona una cuenta a partir de un perfil OAuth.
 * - Si el email ya existe → devuelve su sesión (primer workspace), sea cual sea
 *   el proveedor con el que se dio de alta (un mismo email es una cuenta).
 * - Si no existe → crea cuenta OAuth (sin contraseña) y arranca el onboarding.
 *
 * @param {{ email: string, firstName: string, lastName: string, picture: string|null }} profile
 * @param {'google'|'microsoft'} [provider]
 * @returns {Promise<{ session: { userId: string, workspaceId: string }, isNew: boolean }>}
 */
export async function loginOrProvisionOAuthUser(profile, provider = 'google') {
  await connectToDatabase();

  const existing = await User.findOne({ email: profile.email }).select('_id').lean();
  if (existing) {
    const membership = await WorkspaceMember.findOne({ userId: existing._id })
      .sort({ joinedAt: 1 })
      .select('workspaceId')
      .lean();
    if (!membership) {
      // Caso raro: usuario sin workspace. No debería ocurrir con el alta actual.
      throw new Error('La cuenta no tiene ningún espacio de trabajo');
    }
    logger.info(`Login ${provider} (cuenta existente)`, { userId: String(existing._id) });
    return {
      session: { userId: String(existing._id), workspaceId: String(membership.workspaceId) },
      isNew: false,
    };
  }

  const session = await provisionAccount({
    email: profile.email,
    firstName: profile.firstName,
    lastName: profile.lastName,
    passwordHash: null,
    authProvider: provider,
    workspaceName: 'Mi espacio de trabajo',
    onboardingStep: 'WORKSPACE',
  });

  if (profile.picture) {
    await User.updateOne({ _id: session.userId }, { $set: { avatarUrl: profile.picture } });
  }

  return { session, isNew: true };
}

/** Alias retrocompatible para el callback de Google. */
export function loginOrProvisionGoogleUser(profile) {
  return loginOrProvisionOAuthUser(profile, 'google');
}
