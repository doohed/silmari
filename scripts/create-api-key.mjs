import mongoose from 'mongoose';
import { createAccount } from '@/lib/accounts/signup';
import { createApiKey } from '@/lib/auth/api-key';

/**
 * Crea una cuenta demo + una API key en la BD apuntada por MONGODB_URI e imprime
 * el token en claro (para pruebas por curl). Uso:
 *   MONGODB_URI=... node --loader ./scripts/alias-loader.mjs scripts/create-api-key.mjs
 */
const stamp = Date.now();
const { userId, workspaceId } = await createAccount({
  firstName: 'Curl',
  lastName: 'Demo',
  email: `curl_${stamp}@demo.dev`,
  password: 'secret123',
  workspaceName: 'Curl Demo',
});

const ctx = { userId, workspaceId, role: 'OWNER' };
const { token } = await createApiKey(ctx, { name: 'curl-demo' });

console.log(token);
await mongoose.disconnect();
