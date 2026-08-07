import { writeFileSync } from 'node:fs';
import mongoose from 'mongoose';
import { generateNKeysBetween } from 'fractional-indexing';
import { createAccount } from '@/lib/accounts/signup';
import { getObjectBySlug } from '@/lib/metadata/object-service';
import Record from '@/models/Record';

/**
 * Crea una cuenta demo y siembra N registros de "companies" (insertMany, sin
 * pasar por el servicio, para rendimiento). Imprime y guarda el email para que
 * el test de rendimiento inicie sesión. Uso:
 *   MONGODB_URI=... node --loader ./scripts/alias-loader.mjs scripts/seed-many.mjs [N] [emailFile]
 */
const N = Number(process.argv[2] ?? 5000);
const emailFile = process.argv[3];
const email = `perf_${Date.now()}@demo.dev`;

const { userId, workspaceId } = await createAccount({
  firstName: 'Perf',
  lastName: 'Demo',
  email,
  password: 'secret123',
  workspaceName: 'Perf Demo',
});
const ctx = { userId, workspaceId, role: 'OWNER' };
const object = await getObjectBySlug(ctx, 'companies');

const positions = generateNKeysBetween(null, null, N);
const docs = Array.from({ length: N }, (_, i) => ({
  workspaceId,
  objectMetadataId: object.id,
  data: { name: `Company ${i + 1}`, employees: (i % 500) + 1 },
  position: positions[i],
  searchText: `Company ${i + 1}`,
  createdBy: { userId, name: '', source: 'IMPORT' },
}));

await Record.insertMany(docs);
console.log(email);
if (emailFile) writeFileSync(emailFile, email);
await mongoose.disconnect();
