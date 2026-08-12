import { NextResponse } from 'next/server';
import { randomBytes } from 'node:crypto';
import {
  isMicrosoftConfigured,
  microsoftConsentUrl,
  microsoftRedirectUri,
  MICROSOFT_STATE_COOKIE,
} from '@/lib/auth/oauth/microsoft';

/** Inicia el flujo OAuth de Microsoft: fija `state` y redirige al consentimiento. */
export async function GET(req) {
  const origin = req.nextUrl.origin;
  if (!isMicrosoftConfigured()) {
    return NextResponse.redirect(new URL('/welcome?error=microsoft_not_configured', origin));
  }

  const state = randomBytes(16).toString('hex');
  const url = microsoftConsentUrl({ state, redirectUri: microsoftRedirectUri(origin) });

  const res = NextResponse.redirect(url);
  res.cookies.set(MICROSOFT_STATE_COOKIE, state, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    path: '/',
    maxAge: 600,
  });
  return res;
}
