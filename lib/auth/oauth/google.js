import { createRemoteJWKSet, jwtVerify } from 'jose';

/**
 * Google OAuth 2.0 (authorization code flow). No usamos SDK: hablamos con los
 * endpoints por fetch y verificamos el `id_token` contra el JWKS de Google con
 * `jose` (ya instalado para nuestras sesiones).
 *
 * Requiere en el entorno:
 *   - GOOGLE_CLIENT_ID
 *   - GOOGLE_CLIENT_SECRET
 * El redirect URI se deriva del origen de la petición (`/api/auth/google/callback`)
 * y debe estar registrado en la consola de Google Cloud.
 */

/** Cookie temporal con el `state` anti-CSRF del flujo OAuth de Google. */
// Mismo criterio que la cookie de sesión: `__Host-` en producción, que ata la
// cookie al origen exacto. Sin prefijo en dev, donde no hay HTTPS.
export const GOOGLE_STATE_COOKIE =
  process.env.NODE_ENV === 'production' ? '__Host-g_oauth_state' : 'g_oauth_state';

const AUTH_ENDPOINT = 'https://accounts.google.com/o/oauth2/v2/auth';
const TOKEN_ENDPOINT = 'https://oauth2.googleapis.com/token';
const ISSUERS = ['https://accounts.google.com', 'accounts.google.com'];

const JWKS = createRemoteJWKSet(new URL('https://www.googleapis.com/oauth2/v3/certs'));

/** @returns {boolean} ¿Hay credenciales de Google configuradas? */
export function isGoogleConfigured() {
  return Boolean(process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET);
}

/** URI de callback a partir del origen de la app. */
export function googleRedirectUri(origin) {
  return `${origin.replace(/\/$/, '')}/api/auth/google/callback`;
}

/**
 * URL de consentimiento de Google.
 * @param {{ state: string, redirectUri: string }} input
 */
export function googleConsentUrl({ state, redirectUri }) {
  const params = new URLSearchParams({
    client_id: process.env.GOOGLE_CLIENT_ID,
    redirect_uri: redirectUri,
    response_type: 'code',
    scope: 'openid email profile',
    state,
    access_type: 'online',
    prompt: 'select_account',
  });
  return `${AUTH_ENDPOINT}?${params.toString()}`;
}

/**
 * Canjea el `code` por tokens.
 * @param {{ code: string, redirectUri: string }} input
 * @returns {Promise<{ id_token: string }>}
 */
export async function exchangeCodeForTokens({ code, redirectUri }) {
  const res = await fetch(TOKEN_ENDPOINT, {
    method: 'POST',
    headers: { 'content-type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      code,
      client_id: process.env.GOOGLE_CLIENT_ID,
      client_secret: process.env.GOOGLE_CLIENT_SECRET,
      redirect_uri: redirectUri,
      grant_type: 'authorization_code',
    }),
  });
  if (!res.ok) {
    const detail = await res.text().catch(() => '');
    throw new Error(`Google token exchange falló (${res.status}): ${detail}`);
  }
  return res.json();
}

/**
 * Verifica el `id_token` y devuelve el perfil normalizado.
 * @param {string} idToken
 * @returns {Promise<{ email: string, firstName: string, lastName: string, picture: string|null, emailVerified: boolean }>}
 */
export async function verifyGoogleIdToken(idToken) {
  const { payload } = await jwtVerify(idToken, JWKS, {
    issuer: ISSUERS,
    audience: process.env.GOOGLE_CLIENT_ID,
  });
  if (!payload.email) throw new Error('El id_token de Google no incluye email');
  return {
    email: String(payload.email).toLowerCase(),
    firstName: payload.given_name
      ? String(payload.given_name)
      : String(payload.email).split('@')[0],
    lastName: payload.family_name ? String(payload.family_name) : '',
    picture: payload.picture ? String(payload.picture) : null,
    emailVerified: payload.email_verified === true,
  };
}
