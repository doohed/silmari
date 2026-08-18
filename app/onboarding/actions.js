'use server';

import { redirect } from 'next/navigation';
import { requireContext } from '@/lib/auth/dal';
import { destroySessionCookie } from '@/lib/auth/session';
import { parseOrThrow } from '@/lib/validation/zod-helpers';
import {
  workspaceStepSchema,
  profileStepSchema,
  inviteStepSchema,
} from '@/lib/validation/onboarding';
import { emailSignupSchema } from '@/lib/validation/auth';
import {
  saveWorkspaceStep,
  saveProfileStep,
  saveInviteStep,
  skipInviteStep,
  completePlanStep,
  finishOnboarding,
  inviteUrl,
} from '@/lib/onboarding/service';
import { createInvitation } from '@/lib/invitations/service';
import { toActionError } from '@/lib/errors/to-response';

/** Paso 1 — Crear workspace. */
export async function saveWorkspaceAction(input) {
  try {
    const ctx = await requireContext();
    const data = parseOrThrow(workspaceStepSchema, input);
    await saveWorkspaceStep(ctx, data);
  } catch (err) {
    return toActionError(err);
  }
  redirect('/onboarding');
}

/** Paso 2 — Perfil. */
export async function saveProfileAction(input) {
  try {
    const ctx = await requireContext();
    const data = parseOrThrow(profileStepSchema, input);
    await saveProfileStep(ctx, data);
  } catch (err) {
    return toActionError(err);
  }
  redirect('/onboarding');
}

/** Paso 3 — Enviar invitaciones y avanzar. */
export async function saveInviteAction(input) {
  try {
    const ctx = await requireContext();
    const data = parseOrThrow(inviteStepSchema, input);
    await saveInviteStep(ctx, data);
  } catch (err) {
    return toActionError(err);
  }
  redirect('/onboarding');
}

/** Paso 3 — Saltar invitaciones. */
export async function skipInviteAction() {
  try {
    const ctx = await requireContext();
    await skipInviteStep(ctx);
  } catch (err) {
    return toActionError(err);
  }
  redirect('/onboarding');
}

/**
 * Paso 3 — Generar el enlace de invitación de un email (sin avanzar), para
 * copiarlo al portapapeles.
 * @param {{ email: string }} input
 * @returns {Promise<{ ok: true, url: string } | { ok: false, message: string }>}
 */
export async function createInviteLinkAction(input) {
  try {
    const ctx = await requireContext();
    const { email } = parseOrThrow(emailSignupSchema.pick({ email: true }), input);
    const { token } = await createInvitation(ctx, { email, role: 'MEMBER' });
    return { ok: true, url: inviteUrl(token) };
  } catch (err) {
    return toActionError(err);
  }
}

/** Paso 4 — Plan (visual). Avanza a la bienvenida. */
export async function completePlanAction() {
  try {
    const ctx = await requireContext();
    await completePlanStep(ctx);
  } catch (err) {
    return toActionError(err);
  }
  redirect('/onboarding');
}

/** Paso 5 — Terminar el onboarding y entrar a la app. */
export async function finishAction() {
  try {
    const ctx = await requireContext();
    await finishOnboarding(ctx);
  } catch (err) {
    return toActionError(err);
  }
  redirect('/');
}

/** Cerrar sesión desde el onboarding. */
export async function onboardingLogoutAction() {
  await destroySessionCookie();
  redirect('/welcome');
}
