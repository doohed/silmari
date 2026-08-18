'use server';

import { redirect } from 'next/navigation';
import { createEmailAccount } from '@/lib/accounts/signup';
import { authenticate } from '@/lib/accounts/authenticate';
import { acceptInvitation } from '@/lib/invitations/service';
import { createSessionCookie } from '@/lib/auth/session';
import { throttleAuth } from '@/lib/auth/throttle';
import { requestPasswordReset, resetPassword } from '@/lib/accounts/password-reset';
import { parseOrThrow } from '@/lib/validation/zod-helpers';
import {
  emailSignupSchema,
  loginSchema,
  acceptInviteSchema,
  forgotPasswordSchema,
  resetPasswordSchema,
} from '@/lib/validation/auth';
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
    await throttleAuth('signup', { email: data.email });
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
    await throttleAuth('login', { email: data.email });
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
    await throttleAuth('acceptInvite');
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

/**
 * Pide el enlace de restablecimiento.
 *
 * Devuelve **siempre** el mismo resultado, exista la cuenta o no: si
 * distinguiéramos, este formulario serviría para averiguar qué emails están
 * registrados. El único error que sí se comunica es el del freno por intentos.
 *
 * @param {{ email: string }} input
 */
export async function forgotPasswordAction(input) {
  try {
    const data = parseOrThrow(forgotPasswordSchema, input);
    const { ip } = await throttleAuth('forgotPassword', { email: data.email });
    await requestPasswordReset({ email: data.email, ip });
    return { ok: true };
  } catch (err) {
    return toActionError(err);
  }
}

/**
 * Establece la contraseña nueva desde el enlace del correo. No inicia sesión: al
 * terminar se envía al login.
 * @param {{ token: string, password: string }} input
 */
export async function resetPasswordAction(input) {
  try {
    const data = parseOrThrow(resetPasswordSchema, input);
    await throttleAuth('resetPassword');
    await resetPassword(data);
    return { ok: true };
  } catch (err) {
    return toActionError(err);
  }
}
