import { createRemoteJWKSet, jwtVerify } from 'jose';

/**
 * Microsoft (Azure AD / identity platform) OAuth 2.0, authorization code flow.
 * Sin SDK: fetch a los endpoints v2.0 y verificación del `id_token` con `jose`.
 *
 * Requiere en el entorno:
 *   - MICROSOFT_CLIENT_ID
 *   - MICROSOFT_CLIENT_SECRET
 *   - MICROSOFT_TENANT (opcional; 'common' por defecto: cuentas de trabajo y
 *     personales). Para un solo inquilino, pon su tenant id.
 * El redirect URI se deriva del origen (`/api/auth/microsoft/callback`) y debe
 * estar registrado en el portal de Azure (App registrations).
 */

export const MICROSOFT_STATE_COOKIE = 'ms_oauth_state';

const TENANT = () => process.env.MICROSOFT_TENANT || 'common';
const base = () => `https://login.microsoftonline.com/${TENANT()}`;

const JWKS = createRemoteJWKSet(
  new URL(
    `https://login.microsoftonline.com/${process.env.MICROSOFT_TENANT || 'common'}/discovery/v2.0/keys`,
  ),
);

/** @returns {boolean} ¿Hay credenciales de Microsoft configuradas? */
export function isMicrosoftConfigured() {
  return Boolean(process.env.MICROSOFT_CLIENT_ID && process.env.MICROSOFT_CLIENT_SECRET);
}

/** URI de callback a partir del origen de la app. */
export function microsoftRedirectUri(origin) {
  return `${origin.replace(/\/$/, '')}/api/auth/microsoft/callback`;
}

/** URL de consentimiento de Microsoft. */
export function microsoftConsentUrl({ state, redirectUri }) {
  const params = new URLSearchParams({
    client_id: process.env.MICROSOFT_CLIENT_ID,
    redirect_uri: redirectUri,
    response_type: 'code',
    response_mode: 'query',
    scope: 'openid email profile',
    state,
    prompt: 'select_account',
  });
  return `${base()}/oauth2/v2.0/authorize?${params.toString()}`;
}

/** Canjea el `code` por tokens. */
export async function exchangeCodeForTokens({ code, redirectUri }) {
  const res = await fetch(`${base()}/oauth2/v2.0/token`, {
    method: 'POST',
    headers: { 'content-type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      client_id: process.env.MICROSOFT_CLIENT_ID,
      client_secret: process.env.MICROSOFT_CLIENT_SECRET,
      code,
      redirect_uri: redirectUri,
      grant_type: 'authorization_code',
      scope: 'openid email profile',
    }),
  });
  if (!res.ok) {
    const detail = await res.text().catch(() => '');
    throw new Error(`Microsoft token exchange falló (${res.status}): ${detail}`);
  }
  return res.json();
}

/**
 * Verifica el `id_token` y devuelve el perfil normalizado. Con inquilino
 * 'common' el emisor varía por tenant, así que verificamos firma + audiencia y
 * comprobamos que `iss` corresponde al `tid` del propio token.
 * @param {string} idToken
 */
export async function verifyMicrosoftIdToken(idToken) {
  const { payload } = await jwtVerify(idToken, JWKS, {
    audience: process.env.MICROSOFT_CLIENT_ID,
  });
  const expectedIss = `https://login.microsoftonline.com/${payload.tid}/v2.0`;
  if (!payload.tid || payload.iss !== expectedIss) {
    throw new Error('El emisor del id_token de Microsoft no es válido');
  }

  const email = String(
    payload.email || payload.preferred_username || payload.upn || '',
  ).toLowerCase();
  if (!email) throw new Error('El id_token de Microsoft no incluye email');

  const fullName = payload.name ? String(payload.name) : '';
  const [firstFromName, ...restFromName] = fullName.split(' ');
  return {
    email,
    firstName: payload.given_name
      ? String(payload.given_name)
      : firstFromName || email.split('@')[0],
    lastName: payload.family_name ? String(payload.family_name) : restFromName.join(' '),
    picture: null,
    emailVerified: true,
  };
}
