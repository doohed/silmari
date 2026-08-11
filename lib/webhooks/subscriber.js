import { subscribe } from '@/lib/events/bus';
import { dispatchWebhooks } from '@/lib/webhooks/service';

/**
 * Suscriptor de webhooks salientes: traduce el evento de dominio a la operación
 * de webhook y delega en el despacho existente (firma HMAC + log + reintento).
 * Solo reacciona a eventos que traen `operation`.
 */
subscribe('webhooks', (ctx, event) => {
  if (!event?.operation) return;
  return dispatchWebhooks(ctx, { operation: event.operation, payload: event.payload });
});
