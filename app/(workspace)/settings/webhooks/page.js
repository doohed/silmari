import { requireContext } from '@/lib/auth/dal';
import { listWebhooks } from '@/lib/webhooks/service';
import { listObjects } from '@/lib/metadata/object-service';
import { WebhooksPanel } from '@/components/settings/WebhooksPanel';
import { SettingsPage } from '@/components/settings/SettingsPage';

export const metadata = { title: 'Webhooks · Silmari' };

export default async function WebhooksPage() {
  const ctx = await requireContext();
  const [webhooks, objects] = await Promise.all([listWebhooks(ctx), listObjects(ctx)]);
  return (
    <SettingsPage title="Webhooks">
      <WebhooksPanel initialWebhooks={webhooks} objects={objects} />
    </SettingsPage>
  );
}
