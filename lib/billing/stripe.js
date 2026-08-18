import 'server-only';
import Stripe from 'stripe';

/**
 * Cliente de Stripe, perezoso: no se construye al importar el módulo, para que
 * la app arranque sin claves configuradas (desarrollo, tests, CI).
 *
 * A diferencia de `lib/mailer/`, aquí sí usamos el SDK oficial en vez de
 * `fetch`: verificar la firma de un webhook con la tolerancia de tiempo y la
 * comparación en tiempo constante es fácil de hacer mal, y esto mueve dinero.
 */

let cached = null;

/** @returns {Stripe} */
export function stripe() {
  if (cached) return cached;
  const key = process.env.STRIPE_SECRET_KEY;
  if (!key) throw new Error('Falta STRIPE_SECRET_KEY');
  cached = new Stripe(key, {
    // Fijar la versión evita que un cambio en el panel de Stripe altere las
    // respuestas bajo los pies de la app.
    apiVersion: '2025-10-29.clover',
    appInfo: { name: 'Silmari' },
  });
  return cached;
}

/** ¿Está la facturación configurada? La UI lo usa para no ofrecer lo que no hay. */
export function billingIsConfigured() {
  return Boolean(process.env.STRIPE_SECRET_KEY);
}

/** Solo para tests: olvida el cliente memorizado. */
export function _resetStripe() {
  cached = null;
}
