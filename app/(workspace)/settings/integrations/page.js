import { requireContext } from '@/lib/auth/dal';
import { getEmailConnection, getWhatsappConnection } from '@/lib/integrations/service';
import { IntegrationsPanel } from '@/components/settings/IntegrationsPanel';
import { SettingsPage } from '@/components/settings/SettingsPage';

export const metadata = { title: 'Integraciones · Silmari' };

export default async function IntegrationsPage() {
  const ctx = await requireContext();
  const [email, whatsapp] = await Promise.all([
    getEmailConnection(ctx),
    getWhatsappConnection(ctx),
  ]);

  return (
    <SettingsPage title="Integraciones">
      <IntegrationsPanel email={email} whatsapp={whatsapp} />
    </SettingsPage>
  );
}
