import { NextResponse } from 'next/server';
import { randomBytes } from 'node:crypto';
import {
  isGoogleConfigured,
  googleConsentUrl,
  googleRedirectUri,
  GOOGLE_STATE_COOKIE,
} from '@/lib/auth/oauth/google';

/** Inicia el flujo OAuth de Google: fija `state` y redirige al consentimiento. */
export async function GET(req) {
  const origin = req.nextUrl.origin;
  if (!isGoogleConfigured()) {
    return NextResponse.redirect(new URL('/welcome?error=google_not_configured', origin));
  }

  const state = randomBytes(16).toString('hex');
  const url = googleConsentUrl({ state, redirectUri: googleRedirectUri(origin) });

  const res = NextResponse.redirect(url);
  res.cookies.set(GOOGLE_STATE_COOKIE, state, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    path: '/',
    maxAge: 600,
  });
  return res;
}
