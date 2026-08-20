import mongoose from 'mongoose';
import { connectToDatabase } from '@/lib/db/connect';
import { isSafeRedirectUrl } from '@/lib/forms/redirect-url';
import WebForm from '@/models/WebForm';

/**
 * Migración: pone a `null` los `redirectUrl` de formularios web que no sean
 * http(s).
 *
 * Hasta ahora el campo se guardaba sin validar el esquema, y un `javascript:`
 * ahí se ejecutaba en nuestro propio origen desde la página pública del
 * formulario. El servicio ya lo rechaza al guardar y `getPublicForm` ya no lo
 * sirve; esto limpia lo que quedara en la base de datos.
 *
 * Idempotente: correrlo dos veces no cambia nada la segunda vez.
 *
 * Uso:
 *   MONGODB_URI=... node --no-warnings --loader ./scripts/alias-loader.mjs \
 *     scripts/clean-form-redirect-urls.mjs
 */

await connectToDatabase();

const forms = await WebForm.find({ redirectUrl: { $nin: [null, ''] } });
let cleaned = 0;

for (const form of forms) {
  if (isSafeRedirectUrl(form.redirectUrl)) continue;
  console.log(`  ${form.slug}: se descarta "${String(form.redirectUrl).slice(0, 80)}"`);
  form.redirectUrl = null;
  await form.save();
  cleaned += 1;
}

console.log(`Listo. Formularios revisados: ${forms.length}, redirecciones limpiadas: ${cleaned}.`);
await mongoose.disconnect();
