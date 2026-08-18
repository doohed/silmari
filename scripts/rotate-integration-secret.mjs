/**
 * Re-cifra los secretos de integraciones con una clave nueva.
 *
 * Su caso principal es la separación de `AUTH_SECRET` e `INTEGRATIONS_SECRET`:
 * lo cifrado hasta ahora usaba el primero, y a partir de aquí usa el segundo.
 * También sirve para rotar `INTEGRATIONS_SECRET` en sí.
 *
 * Uso:
 *   OLD_SECRET="<el AUTH_SECRET con el que se cifró>" \
 *   NEW_SECRET="<el nuevo INTEGRATIONS_SECRET>" \
 *   MONGODB_URI="..." \
 *   node --no-warnings --loader ./scripts/alias-loader.mjs scripts/rotate-integration-secret.mjs
 *
 * Es **idempotente en la práctica**: los documentos que no se pueden descifrar
 * con `OLD_SECRET` se cuentan aparte y se dejan intactos, así que repetirlo tras
 * un fallo a medias no rompe nada.
 *
 * Haz un backup antes (`npm run backup`). Y cuando termine, actualiza
 * `INTEGRATIONS_SECRET` en el entorno **antes** de reiniciar la app.
 */

import mongoose from 'mongoose';
import { deriveKey, encryptWithKey, decryptWithKey } from '@/lib/utils/crypto';
import Integration from '@/models/Integration';

const { OLD_SECRET, NEW_SECRET, MONGODB_URI } = process.env;

if (!OLD_SECRET || !NEW_SECRET) {
  console.error('Faltan OLD_SECRET y/o NEW_SECRET');
  process.exit(1);
}
if (!MONGODB_URI) {
  console.error('Falta MONGODB_URI');
  process.exit(1);
}
if (OLD_SECRET === NEW_SECRET) {
  console.error('OLD_SECRET y NEW_SECRET son iguales: no hay nada que rotar');
  process.exit(1);
}

const oldKey = deriveKey(OLD_SECRET);
const newKey = deriveKey(NEW_SECRET);

await mongoose.connect(MONGODB_URI);
console.log('Conectado a MongoDB');

const docs = await Integration.find({ secret: { $ne: null } });
console.log(`${docs.length} integraciones con secreto`);

let rotated = 0;
let skipped = 0;

for (const doc of docs) {
  try {
    const plain = decryptWithKey(doc.secret, oldKey);
    doc.secret = encryptWithKey(plain, newKey);
    await doc.save();
    rotated += 1;
  } catch {
    // No descifra con la clave vieja: o ya está rotado, o se cifró con otra.
    skipped += 1;
    console.warn(`  · ${doc._id}: no se pudo descifrar con OLD_SECRET, se deja como está`);
  }
}

console.log(`\nRotadas: ${rotated} · Sin tocar: ${skipped}`);
if (rotated > 0) {
  console.log('Actualiza INTEGRATIONS_SECRET en el entorno y reinicia la app.');
}

await mongoose.disconnect();
