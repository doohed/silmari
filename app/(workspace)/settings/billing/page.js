import { requireContext } from '@/lib/auth/dal';
import { can } from '@/lib/auth/permissions';
import { getSubscription, listPlans } from '@/lib/billing/service';
import { currentUsage } from '@/lib/billing/limits';
import { BillingPanel } from '@/components/settings/BillingPanel';

export const metadata = { title: 'Facturación · Silmari' };

export default async function BillingPage() {
  const ctx = await requireContext();
  const [subscription, usage] = await Promise.all([getSubscription(ctx), currentUsage(ctx)]);

  return (
    <div className="mx-auto max-w-2xl px-8 py-8">
      <h1 className="text-primary mb-1 text-xl font-semibold tracking-tight">Facturación</h1>
      <p className="text-secondary mb-6 text-sm">
        Tu plan, lo que llevas consumido y el cambio de suscripción.
      </p>
      <BillingPanel
        subscription={subscription}
        usage={usage}
        plans={listPlans()}
        canManage={can(ctx, 'billing:manage')}
      />
    </div>
  );
}
