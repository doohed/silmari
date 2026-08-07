import { SignJWT, jwtVerify } from 'jose';

/**
 * Firma/verificación del JWT de sesión con jose. Módulo puro (solo jose): así
 * puede usarse tanto en el servidor (session.js) como en `proxy.js` sin arrastrar
 * `next/headers` ni `server-only`.
 */

const MAX_AGE_SECONDS = 7 * 24 * 60 * 60; // 7 días

function getKey() {
  const secret = process.env.AUTH_SECRET;
  if (!secret) throw new Error('Falta la variable de entorno AUTH_SECRET');
  return new TextEncoder().encode(secret);
}

/** @typedef {{ userId: string, workspaceId: string }} SessionPayload */

/**
 * @param {SessionPayload} payload
 * @returns {Promise<string>}
 */
export async function encryptSession(payload) {
  return new SignJWT(payload)
    .setProtectedHeader({ alg: 'HS256' })
    .setIssuedAt()
    .setExpirationTime(`${MAX_AGE_SECONDS}s`)
    .sign(getKey());
}

/**
 * @param {string | undefined} token
 * @returns {Promise<SessionPayload | null>}
 */
export async function decryptSession(token) {
  if (!token) return null;
  try {
    const { payload } = await jwtVerify(token, getKey(), { algorithms: ['HS256'] });
    if (!payload.userId || !payload.workspaceId) return null;
    return { userId: String(payload.userId), workspaceId: String(payload.workspaceId) };
  } catch {
    return null;
  }
}

export const SESSION_COOKIE = 'silmari_session';
export const SESSION_MAX_AGE = MAX_AGE_SECONDS;
