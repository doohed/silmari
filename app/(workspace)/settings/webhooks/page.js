import { requireContext } from '@/lib/auth/dal';
import { listWebhooks } from '@/lib/webhooks/service';
import { listObjects } from '@/lib/metadata/object-service';
import { WebhooksPanel } from '@/components/settings/WebhooksPanel';

export default async function WebhooksPage() {
  const ctx = await requireContext();
  const [webhooks, objects] = await Promise.all([listWebhooks(ctx), listObjects(ctx)]);
  return (
    <div className="mx-auto max-w-2xl px-8 py-8">
      <h1 className="text-primary mb-1 text-xl font-semibold tracking-tight">Webhooks</h1>
      <p className="text-secondary mb-6 text-sm">
        Notifican a una URL externa en eventos de registro.
      </p>
      <WebhooksPanel initialWebhooks={webhooks} objects={objects} />
    </div>
  );
}
