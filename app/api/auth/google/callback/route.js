import { NextResponse } from 'next/server';
import {
  exchangeCodeForTokens,
  verifyGoogleIdToken,
  googleRedirectUri,
  GOOGLE_STATE_COOKIE,
} from '@/lib/auth/oauth/google';
import { loginOrProvisionGoogleUser } from '@/lib/accounts/oauth';
import { encryptSession, SESSION_COOKIE, SESSION_MAX_AGE } from '@/lib/auth/jwt';
import { logger } from '@/lib/utils/logger';

/** Callback de Google: valida `state`, canjea el código, crea la sesión. */
export async function GET(req) {
  const url = req.nextUrl;
  const origin = url.origin;
  const fail = (reason) => NextResponse.redirect(new URL(`/welcome?error=${reason}`, origin));

  if (url.searchParams.get('error')) return fail('google_denied');
  const code = url.searchParams.get('code');
  const state = url.searchParams.get('state');
  const cookieState = req.cookies.get(GOOGLE_STATE_COOKIE)?.value;
  if (!code) return fail('google_denied');
  if (!state || !cookieState || state !== cookieState) return fail('google_state');

  try {
    const { id_token: idToken } = await exchangeCodeForTokens({
      code,
      redirectUri: googleRedirectUri(origin),
    });
    const profile = await verifyGoogleIdToken(idToken);
    const { session, isNew } = await loginOrProvisionGoogleUser(profile);

    const token = await encryptSession(session);
    const res = NextResponse.redirect(new URL(isNew ? '/onboarding' : '/', origin));
    res.cookies.set(SESSION_COOKIE, token, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      path: '/',
      maxAge: SESSION_MAX_AGE,
    });
    res.cookies.delete(GOOGLE_STATE_COOKIE);
    return res;
  } catch (err) {
    logger.error('Fallo en el callback de Google', { message: err?.message });
    return fail('google_failed');
  }
}
