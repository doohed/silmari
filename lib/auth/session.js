import 'server-only';
import { cookies } from 'next/headers';
import { encryptSession, decryptSession, SESSION_COOKIE, SESSION_MAX_AGE } from '@/lib/auth/jwt';

/**
 * Gestión de la cookie de sesión (solo servidor). La firma/verificación del JWT
 * vive en `lib/auth/jwt.js` para poder reutilizarse en `proxy.js`.
 */

/** @typedef {import('@/lib/auth/jwt').SessionPayload} SessionPayload */

const cookieOptions = () => ({
  httpOnly: true,
  // En http://localhost (dev) una cookie Secure no se envía; solo en producción.
  secure: process.env.NODE_ENV === 'production',
  sameSite: 'lax',
  path: '/',
  maxAge: SESSION_MAX_AGE,
});

/**
 * Crea la cookie de sesión.
 * @param {SessionPayload} payload
 */
export async function createSessionCookie(payload) {
  const token = await encryptSession(payload);
  const store = await cookies();
  store.set(SESSION_COOKIE, token, cookieOptions());
}

/**
 * Lee y verifica la cookie de sesión.
 * @returns {Promise<SessionPayload | null>}
 */
export async function readSessionCookie() {
  const store = await cookies();
  return decryptSession(store.get(SESSION_COOKIE)?.value);
}

/** Elimina la cookie de sesión (logout). */
export async function destroySessionCookie() {
  const store = await cookies();
  store.delete(SESSION_COOKIE);
}
