/**
 * Definición de planes y sus límites. Módulo **puro**: sin BD, sin red y sin
 * Stripe, para poder testearlo y para poder importarlo desde el cliente (la
 * página de precios enseña estos mismos números).
 *
 * Los límites viven aquí, en código, y no en Stripe: Stripe es la fuente de
 * verdad de *qué ha pagado* el workspace, no de *qué puede hacer*. Así un fallo
 * o un cambio en el panel de Stripe no altera en silencio lo que la app permite.
 */

/** @typedef {'FREE'|'PRO'|'BUSINESS'} PlanKey */

/** `null` en un límite significa "sin tope". */
export const PLANS = {
  FREE: {
    key: 'FREE',
    label: 'Gratis',
    priceMonthly: 0,
    // Dos y no uno en API keys y webhooks a propósito: con un único hueco no se
    // puede **rotar** una credencial sin cortar la integración (habría que
    // revocar antes de crear). Un plan gratuito puede ser pequeño, no hostil.
    limits: { members: 2, records: 1000, apiKeys: 2, webhooks: 2, leadIntakes: 2 },
    // Espacio de adjuntos. Va aparte de `limits` porque no se cuenta en
    // unidades sino en bytes, y el mensaje de error se escribe en MB.
    storageBytes: 100 * 1024 * 1024,
  },
  PRO: {
    key: 'PRO',
    label: 'Pro',
    priceMonthly: 29,
    limits: { members: 10, records: 50000, apiKeys: 10, webhooks: 10, leadIntakes: 10 },
    storageBytes: 5 * 1024 * 1024 * 1024,
  },
  BUSINESS: {
    key: 'BUSINESS',
    label: 'Business',
    priceMonthly: 99,
    limits: { members: null, records: null, apiKeys: null, webhooks: null, leadIntakes: null },
    storageBytes: null,
  },
};

/** Plan por defecto de un workspace sin suscripción. */
export const DEFAULT_PLAN = 'FREE';

/**
 * Estados de Stripe que dan derecho al plan de pago. `past_due` entra a
 * propósito: cuando falla un cobro no se corta el servicio de golpe, se deja el
 * margen de reintentos de Stripe antes de degradar.
 */
export const ACTIVE_STATUSES = new Set(['active', 'trialing', 'past_due']);

/**
 * Resuelve el plan efectivo de una suscripción.
 * @param {{ plan?: string, status?: string } | null | undefined} subscription
 * @returns {typeof PLANS[PlanKey]}
 */
export function resolvePlan(subscription) {
  if (!subscription) return PLANS[DEFAULT_PLAN];
  const plan = PLANS[subscription.plan];
  if (!plan) return PLANS[DEFAULT_PLAN];
  // Suscripción cancelada o impagada más allá del margen: vuelve a Gratis.
  if (!ACTIVE_STATUSES.has(subscription.status)) return PLANS[DEFAULT_PLAN];
  return plan;
}

/**
 * ¿Cabe una unidad más de `resource` con `current` en uso?
 * @param {typeof PLANS[PlanKey]} plan
 * @param {keyof typeof PLANS.FREE.limits} resource
 * @param {number} current
 * @returns {boolean}
 */
export function isWithinLimit(plan, resource, current) {
  const max = plan.limits[resource];
  if (max === null || max === undefined) return true;
  return current < max;
}

/** Etiqueta legible del recurso, para los mensajes de error. */
export const RESOURCE_LABELS = {
  members: 'miembros',
  records: 'registros',
  apiKeys: 'API keys',
  webhooks: 'webhooks',
  leadIntakes: 'configuraciones de entrada de leads',
};

/**
 * Mapea un `price` de Stripe a una clave de plan. Se configura por entorno para
 * que los ids de prueba y los de producción no se mezclen en el código.
 * @param {string} priceId
 * @returns {PlanKey | null}
 */
export function planFromPriceId(priceId) {
  if (!priceId) return null;
  if (priceId === process.env.STRIPE_PRICE_PRO) return 'PRO';
  if (priceId === process.env.STRIPE_PRICE_BUSINESS) return 'BUSINESS';
  return null;
}

/** El `price` de Stripe de un plan, para abrir el Checkout. */
export function priceIdForPlan(planKey) {
  if (planKey === 'PRO') return process.env.STRIPE_PRICE_PRO || null;
  if (planKey === 'BUSINESS') return process.env.STRIPE_PRICE_BUSINESS || null;
  return null;
}
