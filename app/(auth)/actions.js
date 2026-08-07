'use server';

import { redirect } from 'next/navigation';
import { createEmailAccount } from '@/lib/accounts/signup';
import { authenticate } from '@/lib/accounts/authenticate';
import { acceptInvitation } from '@/lib/invitations/service';
import { createSessionCookie } from '@/lib/auth/session';
import { parseOrThrow } from '@/lib/validation/zod-helpers';
import { emailSignupSchema, loginSchema, acceptInviteSchema } from '@/lib/validation/auth';
import { ValidationError } from '@/lib/errors/domain-errors';
import { toActionError } from '@/lib/errors/to-response';

/**
 * Alta por email desde la puerta de entrada: solo email + contraseña. Al terminar
 * deja la sesión iniciada y arranca el onboarding.
 * @param {object} input
 */
export async function signupAction(input) {
  try {
    const data = parseOrThrow(emailSignupSchema, input);
    const session = await createEmailAccount(data);
    await createSessionCookie(session);
  } catch (err) {
    return toActionError(err);
  }
  redirect('/onboarding');
}

/**
 * Inicio de sesión.
 * @param {object} input
 */
export async function loginAction(input) {
  try {
    const data = parseOrThrow(loginSchema, input);
    const session = await authenticate(data);
    await createSessionCookie(session);
  } catch (err) {
    return toActionError(err);
  }
  redirect('/');
}

/**
 * Aceptar invitación. Para usuarios nuevos exige nombre + contraseña; para
 * usuarios existentes basta el token (llega en la URL).
 * @param {{ token: string, isExistingUser?: boolean, firstName?: string, lastName?: string, password?: string }} input
 */
export async function acceptInviteAction(input) {
  try {
    if (!input?.token) throw new ValidationError('Invitación no válida');
    let payload;
    if (input.isExistingUser) {
      payload = { token: input.token };
    } else {
      const parsed = parseOrThrow(acceptInviteSchema, input);
      payload = { token: input.token, ...parsed };
    }
    const session = await acceptInvitation(payload);
    await createSessionCookie(session);
  } catch (err) {
    return toActionError(err);
  }
  redirect('/');
}
