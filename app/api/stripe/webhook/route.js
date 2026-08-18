import { stripe, billingIsConfigured } from '@/lib/billing/stripe';
import { claimEvent, applySubscription, cancelSubscription } from '@/lib/billing/service';
import { logger } from '@/lib/utils/logger';

export const dynamic = 'force-dynamic';

/**
 * POST /api/stripe/webhook — eventos de suscripción de Stripe.
 *
 * Tres cosas que no se pueden hacer de otra manera:
 *
 * 1. **Cuerpo crudo.** La firma se calcula sobre los bytes tal cual llegan, así
 *    que hay que leer con `request.text()`. Un `request.json()` reserializado ya
 *    no coincide.
 * 2. **Idempotencia.** Stripe reintenta hasta recibir un 2xx y puede reentregar
 *    un evento ya procesado; `claimEvent` corta la reaplicación.
 * 3. **Responder rápido y con 2xx salvo error real.** Un 500 hace que Stripe
 *    reintente; si el fallo es nuestro y permanente, reintentar no arregla nada
 *    y acaba desactivando el endpoint. Por eso los errores de procesado se
 *    registran y se devuelve 200: el evento queda en el panel de Stripe para
 *    reenviarlo a mano.
 */
export async function POST(request) {
  if (!billingIsConfigured()) {
    return Response.json({ error: 'Facturación no configurada' }, { status: 503 });
  }

  const secret = process.env.STRIPE_WEBHOOK_SECRET;
  if (!secret) {
    logger.error('Falta STRIPE_WEBHOOK_SECRET');
    return Response.json({ error: 'Webhook no configurado' }, { status: 503 });
  }

  const signature = request.headers.get('stripe-signature');
  const rawBody = await request.text();

  let event;
  try {
    event = stripe().webhooks.constructEvent(rawBody, signature, secret);
  } catch (err) {
    // Firma inválida: 400 y no se reintenta. Es la respuesta correcta a algo
    // que no viene de Stripe.
    logger.error('Firma de webhook de Stripe no válida', { message: err?.message });
    return Response.json({ error: 'Firma no válida' }, { status: 400 });
  }

  const isFirstTime = await claimEvent(event);
  if (!isFirstTime) {
    logger.info('Evento de Stripe repetido, ignorado', { id: event.id, type: event.type });
    return Response.json({ received: true, duplicated: true });
  }

  try {
    switch (event.type) {
      case 'customer.subscription.created':
      case 'customer.subscription.updated':
        await applySubscription(event.data.object);
        break;
      case 'customer.subscription.deleted':
        await cancelSubscription(event.data.object);
        break;
      case 'checkout.session.completed': {
        // El alta real llega en `customer.subscription.created`; aquí solo se
        // deja constancia, porque el orden de los dos eventos no está garantizado.
        logger.info('Checkout completado', { id: event.id });
        break;
      }
      case 'invoice.payment_failed':
        logger.error('Pago fallido en Stripe', { id: event.id });
        break;
      default:
        logger.info('Evento de Stripe sin manejar', { type: event.type });
    }
  } catch (err) {
    logger.error('Fallo procesando un evento de Stripe', {
      id: event.id,
      type: event.type,
      message: err?.message,
    });
  }

  return Response.json({ received: true });
}
