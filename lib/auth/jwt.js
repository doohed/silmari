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

/**
 * @typedef {object} SessionPayload
 * @property {string} userId
 * @property {string} workspaceId
 * @property {number} [iat] Momento de emisión (segundos). Lo pone `jose` al
 *   firmar; se devuelve al verificar porque el DAL lo compara con
 *   `User.sessionsValidFrom` para invalidar las sesiones anteriores a un cambio
 *   de contraseña.
 */

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
    return {
      userId: String(payload.userId),
      workspaceId: String(payload.workspaceId),
      iat: typeof payload.iat === 'number' ? payload.iat : undefined,
    };
  } catch {
    return null;
  }
}

/**
 * ¿Sigue vigente esta sesión, o se emitió antes del último corte de la cuenta?
 *
 * Un JWT no se puede revocar: no hay estado en el servidor que consultar. El
 * sustituto es `User.sessionsValidFrom`, una fecha que se adelanta al cambiar o
 * restablecer la contraseña; toda sesión firmada antes deja de valer. Sin esto,
 * a quien le roban la cuenta cambia la contraseña y **la sesión del atacante
 * sigue viva hasta siete días**: la contramedida no surtiría efecto.
 *
 * El `iat` va en **segundos**, así que el corte se compara con el segundo
 * redondeado hacia abajo. Un token sin `iat` (no debería existir, `encryptSession`
 * siempre lo pone) se trata como anterior a cualquier corte.
 *
 * Vive aquí, junto a la firma del token, y no en el DAL: es una regla del token,
 * no del acceso a datos.
 *
 * @param {SessionPayload | null | undefined} session
 * @param {Date | string | number | null | undefined} sessionsValidFrom
 * @returns {boolean}
 */
export function isSessionCurrent(session, sessionsValidFrom) {
  if (!session) return false;
  if (!sessionsValidFrom) return true; // cuenta sin cortes: cualquier sesión vale
  if (typeof session.iat !== 'number') return false;
  return session.iat >= Math.floor(new Date(sessionsValidFrom).getTime() / 1000);
}

/**
 * Nombre de la cookie de sesión.
 *
 * En producción lleva el prefijo **`__Host-`**, que el navegador solo acepta si
 * la cookie es `Secure`, tiene `Path=/` y **no** declara `Domain`. Eso la ata al
 * origen exacto: un subdominio comprometido (o un atacante en un subdominio
 * vecino) no puede sobrescribirla ni fijar una sesión ajena.
 *
 * En desarrollo se queda sin prefijo porque `__Host-` exige `Secure` y en
 * `http://localhost` una cookie `Secure` no viaja: el login dejaría de funcionar.
 *
 * OJO al desplegar esto por primera vez: cambia el nombre de la cookie, así que
 * las sesiones abiertas en producción se pierden y hay que volver a entrar.
 */
export const SESSION_COOKIE =
  process.env.NODE_ENV === 'production' ? '__Host-silmari_session' : 'silmari_session';
export const SESSION_MAX_AGE = MAX_AGE_SECONDS;
