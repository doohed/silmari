import { loadWhatsappConfig } from '@/lib/integrations/service';

const GRAPH_VERSION = 'v21.0';

/**
 * Proveedor de WhatsApp por la **Cloud API de Meta**. Lee la conexión del
 * workspace (phone_number_id + token) de Ajustes → Integraciones; si no hay
 * ninguna activa, devuelve `null`. Envía un mensaje de texto con un POST a la
 * Graph API.
 *
 * @param {import('@/lib/auth/permissions').Ctx} ctx
 * @returns {Promise<null | { send: (msg: { to:string, body:string }) => Promise<{ externalId: string }> }>}
 */
export async function getWhatsappProvider(ctx) {
  const cfg = await loadWhatsappConfig(ctx);
  if (!cfg) return null;

  return {
    async send({ to, body }) {
      const url = `https://graph.facebook.com/${GRAPH_VERSION}/${cfg.phoneNumberId}/messages`;
      const res = await fetch(url, {
        method: 'POST',
        headers: {
          authorization: `Bearer ${cfg.accessToken}`,
          'content-type': 'application/json',
        },
        body: JSON.stringify({
          messaging_product: 'whatsapp',
          to,
          type: 'text',
          text: { body: body ?? '' },
        }),
        signal: AbortSignal.timeout(10000),
      });
      const json = await res.json().catch(() => ({}));
      if (!res.ok) {
        const msg = json?.error?.message || `Error ${res.status} de la Cloud API`;
        throw new Error(msg);
      }
      return { externalId: json?.messages?.[0]?.id ?? '' };
    },
  };
}

/** @returns {Promise<boolean>} ¿Hay un número de WhatsApp conectado para enviar? */
export async function isWhatsappConfigured(ctx) {
  return (await loadWhatsappConfig(ctx)) != null;
}
