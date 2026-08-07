import mongoose from 'mongoose';
import { randomBytes } from 'node:crypto';
import { connectToDatabase } from '@/lib/db/connect';
import { hashPassword } from '@/lib/auth/password';
import { slugify } from '@/lib/utils/slugify';
import { ConflictError } from '@/lib/errors/domain-errors';
import { logger } from '@/lib/utils/logger';
import { seedStandardObjects } from '@/lib/metadata/seed-standard';
import { syncFieldIndex } from '@/lib/db/indexes';
import User from '@/models/User';
import Workspace from '@/models/Workspace';
import WorkspaceMember from '@/models/WorkspaceMember';

/**
 * Genera un slug único para el workspace (best-effort + índice único como guardia).
 * @param {string} name
 * @returns {Promise<string>}
 */
async function uniqueWorkspaceSlug(name) {
  const base = slugify(name) || 'espacio';
  const existing = await Workspace.findOne({ slug: base }).select('_id').lean();
  if (!existing) return base;
  return `${base}-${randomBytes(2).toString('hex')}`;
}

/**
 * Núcleo de aprovisionamiento: crea usuario + workspace + miembro OWNER en una
 * única transacción y siembra los objetos estándar. Lo comparten el alta por
 * email (`createAccount`/`createEmailAccount`) y la de OAuth (Google).
 *
 * @param {object} input
 * @param {string} input.email
 * @param {string} input.firstName
 * @param {string} [input.lastName]
 * @param {string|null} [input.passwordHash] Null en cuentas OAuth.
 * @param {'email'|'google'} [input.authProvider]
 * @param {string} input.workspaceName
 * @param {import('@/models/User').OnboardingStep} [input.onboardingStep]
 * @returns {Promise<{ userId: string, workspaceId: string }>}
 */
export async function provisionAccount({
  email,
  firstName,
  lastName = '',
  passwordHash = null,
  authProvider = 'email',
  workspaceName,
  onboardingStep = 'DONE',
}) {
  await connectToDatabase();

  const existing = await User.findOne({ email }).select('_id').lean();
  if (existing) {
    throw new ConflictError('Ya existe una cuenta con este email', {
      fieldErrors: { email: ['Ya existe una cuenta con este email'] },
    });
  }

  const slug = await uniqueWorkspaceSlug(workspaceName);

  const session = await mongoose.startSession();
  try {
    let userId;
    let workspaceId;
    let fieldsToIndex = [];

    await session.withTransaction(async () => {
      const [user] = await User.create(
        [{ firstName, lastName, email, passwordHash, authProvider, onboardingStep }],
        { session },
      );
      const [workspace] = await Workspace.create([{ name: workspaceName, slug }], { session });
      await WorkspaceMember.create(
        [{ workspaceId: workspace._id, userId: user._id, role: 'OWNER', joinedAt: new Date() }],
        { session },
      );
      // Siembra de objetos estándar (Company, Person, Opportunity, Note, Task, Attachment).
      const { toIndex } = await seedStandardObjects({ workspaceId: workspace._id }, { session });
      fieldsToIndex = toIndex;
      userId = String(user._id);
      workspaceId = String(workspace._id);
    });

    // Los índices dinámicos se crean fuera de la transacción (Mongo no lo permite en tx).
    for (const field of fieldsToIndex) {
      await syncFieldIndex(field);
    }

    logger.info('Cuenta creada', { userId, workspaceId, authProvider, onboardingStep });
    return { userId, workspaceId };
  } catch (err) {
    // Colisión de índice único (email o slug) por carrera concurrente.
    if (err?.code === 11000) {
      const field = err?.keyPattern?.email ? 'email' : 'workspace';
      throw new ConflictError('No se pudo crear la cuenta: dato duplicado', {
        fieldErrors: field === 'email' ? { email: ['Ya existe una cuenta con este email'] } : {},
      });
    }
    throw err;
  } finally {
    await session.endSession();
  }
}

/**
 * Alta clásica (nombre + workspace en un paso). La cuenta queda `onboardingStep`
 * en `DONE`: la usan tests, seeds y scripts. El flujo de producto usa
 * `createEmailAccount` + onboarding.
 *
 * @param {{ firstName: string, lastName: string, email: string, password: string, workspaceName: string }} input
 * @returns {Promise<{ userId: string, workspaceId: string }>}
 */
export async function createAccount({ firstName, lastName, email, password, workspaceName }) {
  const passwordHash = await hashPassword(password);
  return provisionAccount({
    email,
    firstName,
    lastName,
    passwordHash,
    authProvider: 'email',
    workspaceName,
    onboardingStep: 'DONE',
  });
}

/**
 * Alta por email desde la puerta de entrada (`/signup`). Solo pide email y
 * contraseña; el nombre y el workspace se completan en el onboarding, por eso
 * queda en `onboardingStep='WORKSPACE'` con datos placeholder.
 *
 * @param {{ email: string, password: string }} input
 * @returns {Promise<{ userId: string, workspaceId: string }>}
 */
export async function createEmailAccount({ email, password }) {
  const passwordHash = await hashPassword(password);
  const firstName = defaultFirstNameFromEmail(email);
  return provisionAccount({
    email,
    firstName,
    passwordHash,
    authProvider: 'email',
    workspaceName: 'Mi espacio de trabajo',
    onboardingStep: 'WORKSPACE',
  });
}

/** Nombre provisional a partir del email (se sustituye en el paso de perfil). */
export function defaultFirstNameFromEmail(email) {
  const local = String(email).split('@')[0] || 'Usuario';
  const cleaned = local.replace(/[._-]+/g, ' ').trim();
  return cleaned.charAt(0).toUpperCase() + cleaned.slice(1);
}
