import { requireContext } from '@/lib/auth/dal';
import { can } from '@/lib/auth/permissions';
import { getSubscription, listPlans } from '@/lib/billing/service';
import { currentUsage } from '@/lib/billing/limits';
import { BillingPanel } from '@/components/settings/BillingPanel';
import { SettingsPage } from '@/components/settings/SettingsPage';

export const metadata = { title: 'Facturación · Silmari' };

export default async function BillingPage() {
  const ctx = await requireContext();
  const [subscription, usage] = await Promise.all([getSubscription(ctx), currentUsage(ctx)]);

  return (
    <SettingsPage title="Facturación">
      <BillingPanel
        subscription={subscription}
        usage={usage}
        plans={listPlans()}
        canManage={can(ctx, 'billing:manage')}
      />
    </SettingsPage>
  );
}
