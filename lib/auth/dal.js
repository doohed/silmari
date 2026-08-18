import 'server-only';
import { cache } from 'react';
import { redirect } from 'next/navigation';
import { connectToDatabase } from '@/lib/db/connect';
import { readSessionCookie } from '@/lib/auth/session';
import User from '@/models/User';
import WorkspaceMember from '@/models/WorkspaceMember';

/**
 * Data Access Layer: única puerta para resolver la identidad y el contexto de
 * tenant. La comprobación "segura" (contra BD) vive aquí, cerca de los datos;
 * `proxy.js` solo hace un chequeo optimista de la cookie.
 */

/** @typedef {import('@/lib/auth/permissions').Ctx} Ctx */

/**
 * Payload optimista de la sesión (solo cookie, sin BD). Memoizado por render.
 * @returns {Promise<import('@/lib/auth/session').SessionPayload | null>}
 */
export const getSession = cache(async () => readSessionCookie());

/**
 * Contexto de tenant verificado contra BD: `{ userId, workspaceId, role }`.
 * Devuelve null si no hay sesión válida o si el usuario ya no pertenece al
 * workspace activo (sesión obsoleta). Memoizado por render.
 * @returns {Promise<Ctx | null>}
 */
export const getContext = cache(async () => {
  const session = await getSession();
  if (!session) return null;

  await connectToDatabase();
  const member = await WorkspaceMember.findOne({
    workspaceId: session.workspaceId,
    userId: session.userId,
  }).lean();

  if (!member) return null;
  return { userId: session.userId, workspaceId: session.workspaceId, role: member.role };
});

/**
 * Igual que getContext pero redirige a /login si no hay contexto válido.
 * Úsalo en páginas/acciones que requieren sesión.
 * @returns {Promise<Ctx>}
 */
export async function requireContext() {
  const ctx = await getContext();
  if (!ctx) redirect('/login');
  return ctx;
}

/**
 * DTO del usuario actual para la UI (sin passwordHash). Memoizado por render.
 * @returns {Promise<{ id: string, email: string, firstName: string, lastName: string, avatarUrl: string|null, onboardingStep: string } | null>}
 */
export const getCurrentUser = cache(async () => {
  const session = await getSession();
  if (!session) return null;

  await connectToDatabase();
  const user = await User.findOne({ _id: session.userId, deletedAt: null })
    .select('email firstName lastName avatarUrl onboardingStep emailVerifiedAt')
    .lean();
  if (!user) return null;

  return {
    id: String(user._id),
    email: user.email,
    firstName: user.firstName,
    lastName: user.lastName,
    avatarUrl: user.avatarUrl ?? null,
    onboardingStep: user.onboardingStep ?? 'DONE',
    emailVerified: Boolean(user.emailVerifiedAt),
  };
});

/**
 * Como `requireContext`, pero además exige que el onboarding esté completo.
 * Si no, redirige a `/onboarding`. Úsalo en el layout de la app.
 * @returns {Promise<Ctx>}
 */
export async function requireOnboarded() {
  const ctx = await requireContext();
  const user = await getCurrentUser();
  if (user && user.onboardingStep !== 'DONE') redirect('/onboarding');
  return ctx;
}
