import { requireContext } from '@/lib/auth/dal';
import { listApiKeys } from '@/lib/auth/api-key';
import { ApiKeysPanel } from '@/components/settings/ApiKeysPanel';

export default async function ApiKeysPage() {
  const ctx = await requireContext();
  const keys = await listApiKeys(ctx);
  return (
    <div className="mx-auto max-w-2xl px-8 py-8">
      <h1 className="text-primary mb-1 text-xl font-semibold tracking-tight">API keys</h1>
      <p className="text-secondary mb-6 text-sm">Autentican la API pública en /api/v1.</p>
      <ApiKeysPanel initialKeys={keys} />
    </div>
  );
}
