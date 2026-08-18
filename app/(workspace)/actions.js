'use server';

import { redirect } from 'next/navigation';
import { revalidatePath } from 'next/cache';
import { headers } from 'next/headers';
import { getSession, getContext, requireContext } from '@/lib/auth/dal';
import { resendEmailVerification } from '@/lib/accounts/email-verification';
import { createSessionCookie, destroySessionCookie } from '@/lib/auth/session';
import { getMembershipRole } from '@/lib/workspaces/service';
import { inviteMember, removeMember } from '@/lib/members/service';
import { parseOrThrow } from '@/lib/validation/zod-helpers';
import { inviteSchema } from '@/lib/validation/auth';
import { ValidationError } from '@/lib/errors/domain-errors';
import { toActionError } from '@/lib/errors/to-response';

/** Cierra la sesión. */
export async function logoutAction() {
  await destroySessionCookie();
  redirect('/welcome');
}

/**
 * Cambia el workspace activo. Verifica que el usuario pertenezca al destino
 * (nunca se confía en el cliente) y re-firma la cookie.
 * @param {string} workspaceId
 */
export async function switchWorkspaceAction(workspaceId) {
  try {
    const session = await getSession();
    if (!session) throw new ValidationError('Sesión no válida');
    const role = await getMembershipRole(session.userId, workspaceId);
    if (!role) throw new ValidationError('No perteneces a ese espacio de trabajo');
    await createSessionCookie({ userId: session.userId, workspaceId });
  } catch (err) {
    return toActionError(err);
  }
  revalidatePath('/', 'layout');
  redirect('/');
}

/**
 * Invita a un miembro. El correo lo manda `createInvitation`; el enlace se
 * devuelve igualmente para poder copiarlo (respaldo si el correo no llega).
 * @param {{ email: string, role: 'ADMIN'|'MEMBER' }} input
 * @returns {Promise<{ ok: true, link: string } | import('@/lib/errors/to-response').ActionError>}
 */
export async function inviteMemberAction(input) {
  try {
    const ctx = await requireContext();
    const data = parseOrThrow(inviteSchema, input);
    const { token } = await inviteMember(ctx, data);

    const h = await headers();
    const host = h.get('host') ?? 'localhost:3000';
    const proto = host.startsWith('localhost') ? 'http' : 'https';
    const link = `${proto}://${host}/invite/${token}`;

    revalidatePath('/');
    return { ok: true, link };
  } catch (err) {
    return toActionError(err);
  }
}

/**
 * Elimina a un miembro del workspace actual.
 * @param {string} targetUserId
 */
export async function removeMemberAction(targetUserId) {
  try {
    const ctx = await getContext();
    if (!ctx) throw new ValidationError('Sesión no válida');
    await removeMember(ctx, targetUserId);
    revalidatePath('/');
    return { ok: true };
  } catch (err) {
    return toActionError(err);
  }
}

/** Reenvía el correo de confirmación de email al usuario de la sesión. */
export async function resendVerificationAction() {
  try {
    const ctx = await requireContext();
    return { ok: true, data: await resendEmailVerification(ctx) };
  } catch (err) {
    return toActionError(err);
  }
}
