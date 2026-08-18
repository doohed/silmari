import { createCipheriv, createDecipheriv, randomBytes, scryptSync } from 'node:crypto';

/**
 * Cifrado simétrico para secretos en reposo (contraseña SMTP, token de WhatsApp).
 * AES-256-GCM con clave derivada de `INTEGRATIONS_SECRET`. El formato es
 * `v1:<iv>:<tag>:<ciphertext>` en base64, autocontenido y verificable.
 *
 * **Por qué una variable propia y no `AUTH_SECRET`:** rotar el secreto de sesión
 * es una operación normal (una fuga, una auditoría) y solo debería cerrar las
 * sesiones. Si de él dependiera también este cifrado, rotarlo dejaría ilegibles
 * todos los secretos de integraciones de todos los workspaces, que habría que
 * reconectar a mano uno a uno. Son dos secretos con ciclos de vida distintos.
 *
 * Si `INTEGRATIONS_SECRET` no está definida se cae a `AUTH_SECRET`, para no
 * romper las instalaciones anteriores a esta separación. Para migrar de una a
 * otra: `node scripts/rotate-integration-secret.mjs`.
 */

let cachedKey = null;
function key() {
  if (cachedKey) return cachedKey;
  const secret = process.env.INTEGRATIONS_SECRET || process.env.AUTH_SECRET;
  if (!secret) throw new Error('Falta INTEGRATIONS_SECRET (o AUTH_SECRET) para cifrar secretos');
  // Sal fija: derivamos una clave de 32 bytes estable a partir del secreto.
  cachedKey = scryptSync(secret, 'silmari-integrations-v1', 32);
  return cachedKey;
}

/**
 * Deriva una clave a partir de un secreto concreto, sin pasar por el entorno.
 * Solo lo usa el script de rotación, que necesita descifrar con la clave vieja
 * y volver a cifrar con la nueva en el mismo proceso.
 * @param {string} secret
 */
export function deriveKey(secret) {
  return scryptSync(secret, 'silmari-integrations-v1', 32);
}

/** Cifra con una clave explícita (rotación). */
export function encryptWithKey(plaintext, explicitKey) {
  const iv = randomBytes(12);
  const cipher = createCipheriv('aes-256-gcm', explicitKey, iv);
  const ct = Buffer.concat([cipher.update(String(plaintext), 'utf8'), cipher.final()]);
  const tag = cipher.getAuthTag();
  return `v1:${iv.toString('base64')}:${tag.toString('base64')}:${ct.toString('base64')}`;
}

/** Descifra con una clave explícita (rotación). */
export function decryptWithKey(payload, explicitKey) {
  const [version, ivB64, tagB64, ctB64] = String(payload).split(':');
  if (version !== 'v1') throw new Error('Formato de secreto no reconocido');
  const decipher = createDecipheriv('aes-256-gcm', explicitKey, Buffer.from(ivB64, 'base64'));
  decipher.setAuthTag(Buffer.from(tagB64, 'base64'));
  return Buffer.concat([decipher.update(Buffer.from(ctB64, 'base64')), decipher.final()]).toString(
    'utf8',
  );
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
  return Buffer.concat([decipher.update(Buffer.from(ctB64, 'base64')), decipher.final()]).toString(
    'utf8',
  );
}
