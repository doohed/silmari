import { requireContext } from '@/lib/auth/dal';
import { listApiKeys } from '@/lib/auth/api-key';
import { ApiKeysPanel } from '@/components/settings/ApiKeysPanel';
import { SettingsPage } from '@/components/settings/SettingsPage';

export const metadata = { title: 'API keys · Silmari' };

export default async function ApiKeysPage() {
  const ctx = await requireContext();
  const keys = await listApiKeys(ctx);
  return (
    <SettingsPage title="API keys">
      <ApiKeysPanel initialKeys={keys} />
    </SettingsPage>
  );
}
