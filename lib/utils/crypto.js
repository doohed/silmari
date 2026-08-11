import { createCipheriv, createDecipheriv, randomBytes, scryptSync } from 'node:crypto';

/**
 * Cifrado simétrico para secretos en reposo (contraseña SMTP, token de WhatsApp).
 * AES-256-GCM con clave derivada de `AUTH_SECRET`. El formato es
 * `v1:<iv>:<tag>:<ciphertext>` en base64, autocontenido y verificable.
 *
 * NOTA: si cambias `AUTH_SECRET`, los secretos ya cifrados dejan de descifrarse
 * (habría que reconectarlos). Es el mismo compromiso que la sesión.
 */

let cachedKey = null;
function key() {
  if (cachedKey) return cachedKey;
  const secret = process.env.AUTH_SECRET;
  if (!secret) throw new Error('Falta AUTH_SECRET para cifrar secretos');
  // Sal fija: derivamos una clave de 32 bytes estable a partir del secreto.
  cachedKey = scryptSync(secret, 'silmari-integrations-v1', 32);
  return cachedKey;
}

/** Cifra un texto plano. Devuelve una cadena autocontenida. */
export function encryptSecret(plaintext) {
  const iv = randomBytes(12);
  const cipher = createCipheriv('aes-256-gcm', key(), iv);
  const ct = Buffer.concat([cipher.update(String(plaintext), 'utf8'), cipher.final()]);
  const tag = cipher.getAuthTag();
  return `v1:${iv.toString('base64')}:${tag.toString('base64')}:${ct.toString('base64')}`;
}

/** Descifra una cadena producida por `encryptSecret`. Lanza si está corrupta. */
export function decryptSecret(payload) {
  const [version, ivB64, tagB64, ctB64] = String(payload).split(':');
  if (version !== 'v1') throw new Error('Formato de secreto no reconocido');
  const decipher = createDecipheriv('aes-256-gcm', key(), Buffer.from(ivB64, 'base64'));
  decipher.setAuthTag(Buffer.from(tagB64, 'base64'));
  return Buffer.concat([
    decipher.update(Buffer.from(ctB64, 'base64')),
    decipher.final(),
  ]).toString('utf8');
}
