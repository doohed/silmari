import { requireContext } from '@/lib/auth/dal';
import { getEmailConnection, getWhatsappConnection } from '@/lib/integrations/service';
import { IntegrationsPanel } from '@/components/settings/IntegrationsPanel';

export default async function IntegrationsPage() {
  const ctx = await requireContext();
  const [email, whatsapp] = await Promise.all([
    getEmailConnection(ctx),
    getWhatsappConnection(ctx),
  ]);

  return (
    <div className="mx-auto max-w-2xl px-8 py-8">
      <h1 className="text-primary mb-1 text-xl font-semibold tracking-tight">Integraciones</h1>
      <p className="text-secondary mb-6 text-sm">
        Conecta una cuenta de correo (SMTP) y un número de WhatsApp para poder enviar mensajes desde
        la ficha de un registro. Los secretos se guardan cifrados.
      </p>
      <IntegrationsPanel email={email} whatsapp={whatsapp} />
    </div>
  );
}
