import { connectToDatabase } from '@/lib/db/connect';
import { assertTenant } from '@/lib/services/tenant';
import { can } from '@/lib/auth/permissions';
import { stripe, billingIsConfigured } from '@/lib/billing/stripe';
import { PLANS, resolvePlan, planFromPriceId, priceIdForPlan } from '@/lib/billing/plans';
import { appUrl } from '@/lib/config/app';
import { ForbiddenError, ValidationError } from '@/lib/errors/domain-errors';
import { logger } from '@/lib/utils/logger';
import Subscription from '@/models/Subscription';
import StripeEvent from '@/models/StripeEvent';
import Workspace from '@/models/Workspace';
import User from '@/models/User';

/** DTO de la suscripción para la UI. */
function toDTO(doc) {
  const plan = resolvePlan(doc);
  return {
    plan: plan.key,
    planLabel: plan.label,
    limits: plan.limits,
    status: doc?.status ?? 'none',
    currentPeriodEnd: doc?.currentPeriodEnd ?? null,
    cancelAtPeriodEnd: doc?.cancelAtPeriodEnd ?? false,
    // Sin claves no se puede cobrar: la UI esconde los botones en vez de
    // ofrecer algo que reventaría al pulsarlo.
    configured: billingIsConfigured(),
  };
}

/**
 * Suscripción del workspace actual. Un workspace sin documento está en el plan
 * por defecto, no es un error.
 * @param {import('@/lib/auth/permissions').Ctx} ctx
 */
export async function getSubscription(ctx) {
  assertTenant(ctx);
  await connectToDatabase();
  const doc = await Subscription.findOne({ workspaceId: ctx.workspaceId }).lean();
  return toDTO(doc);
}

/** Igual, pero solo el plan resuelto. Lo usa el control de límites. */
export async function getPlan(ctx) {
  assertTenant(ctx);
  await connectToDatabase();
  const doc = await Subscription.findOne({ workspaceId: ctx.workspaceId })
    .select('plan status')
    .lean();
  return resolvePlan(doc);
}

/** Cliente de Stripe del workspace, creándolo la primera vez. */
async function ensureCustomer(ctx) {
  await connectToDatabase();
  const existing = await Subscription.findOne({ workspaceId: ctx.workspaceId });
  if (existing?.stripeCustomerId) return existing.stripeCustomerId;

  const [workspace, user] = await Promise.all([
    Workspace.findById(ctx.workspaceId).select('name').lean(),
    User.findById(ctx.userId).select('email firstName lastName').lean(),
  ]);

  const customer = await stripe().customers.create({
    email: user?.email,
    name: workspace?.name,
    // El workspaceId viaja en la metadata para poder resolver el tenant desde
    // un evento de webhook, que llega sin sesión.
    metadata: { workspaceId: String(ctx.workspaceId) },
  });

  await Subscription.findOneAndUpdate(
    { workspaceId: ctx.workspaceId },
    { $set: { stripeCustomerId: customer.id } },
    { upsert: true, new: true },
  );
  return customer.id;
}

/**
 * Rutas a las que se puede volver desde Stripe. Es una **lista blanca cerrada**
 * a propósito: si aceptáramos una URL del cliente, tendríamos una redirección
 * abierta servida desde el dominio de Stripe, que es un regalo para el phishing.
 */
const RETURN_PATHS = new Set(['/settings/billing', '/onboarding']);

/**
 * Abre una sesión de Checkout para contratar un plan.
 * @param {import('@/lib/auth/permissions').Ctx} ctx
 * @param {{ plan: 'PRO'|'BUSINESS', returnTo?: string }} input
 * @returns {Promise<{ url: string }>}
 */
export async function createCheckoutSession(ctx, { plan, returnTo = '/settings/billing' }) {
  assertTenant(ctx);
  if (!can(ctx, 'billing:manage')) throw new ForbiddenError('No puedes gestionar la facturación');
  if (!billingIsConfigured()) throw new ValidationError('La facturación no está configurada');

  const price = priceIdForPlan(plan);
  if (!price) throw new ValidationError(`No hay precio configurado para el plan ${plan}`);

  const back = RETURN_PATHS.has(returnTo) ? returnTo : '/settings/billing';

  const customer = await ensureCustomer(ctx);
  const session = await stripe().checkout.sessions.create({
    mode: 'subscription',
    customer,
    line_items: [{ price, quantity: 1 }],
    success_url: `${appUrl()}${back}?estado=ok`,
    cancel_url: `${appUrl()}${back}?estado=cancelado`,
    // Impuestos: con Stripe Tax activo se calcula el IVA según el país del
    // cliente, que es obligatorio vendiendo dentro de la UE.
    automatic_tax: { enabled: true },
    customer_update: { address: 'auto' },
    subscription_data: { metadata: { workspaceId: String(ctx.workspaceId) } },
  });

  return { url: session.url };
}

/**
 * Abre el portal de cliente de Stripe (cambiar tarjeta, facturas, cancelar).
 * Se delega en Stripe a propósito: construir esa UI y mantenerla al día con la
 * normativa no aporta nada al producto.
 */
export async function createPortalSession(ctx) {
  assertTenant(ctx);
  if (!can(ctx, 'billing:manage')) throw new ForbiddenError('No puedes gestionar la facturación');
  if (!billingIsConfigured()) throw new ValidationError('La facturación no está configurada');

  const customer = await ensureCustomer(ctx);
  const session = await stripe().billingPortal.sessions.create({
    customer,
    return_url: `${appUrl()}/settings/billing`,
  });
  return { url: session.url };
}

/**
 * Marca un evento como procesado. Devuelve `false` si ya lo estaba, que es la
 * señal para no reaplicarlo: Stripe reentrega el mismo evento con normalidad.
 * @param {{ id: string, type: string }} event
 * @returns {Promise<boolean>} true si es la primera vez
 */
export async function claimEvent(event) {
  await connectToDatabase();
  try {
    await StripeEvent.create({ _id: event.id, type: event.type });
    return true;
  } catch (err) {
    if (err?.code === 11000) return false;
    throw err;
  }
}

/** Resuelve el workspace de un objeto de Stripe (metadata primero, cliente después). */
async function resolveWorkspaceId(object) {
  const fromMetadata = object?.metadata?.workspaceId;
  if (fromMetadata) return fromMetadata;

  const customerId = typeof object?.customer === 'string' ? object.customer : object?.customer?.id;
  if (!customerId) return null;
  const doc = await Subscription.findOne({ stripeCustomerId: customerId })
    .select('workspaceId')
    .lean();
  return doc ? String(doc.workspaceId) : null;
}

/**
 * Aplica una suscripción de Stripe al espejo local.
 * @param {object} subscription El objeto `subscription` de Stripe
 */
export async function applySubscription(subscription) {
  await connectToDatabase();

  const workspaceId = await resolveWorkspaceId(subscription);
  if (!workspaceId) {
    logger.error('Evento de Stripe sin workspace resoluble', { id: subscription?.id });
    return;
  }

  const priceId = subscription?.items?.data?.[0]?.price?.id;
  const plan = planFromPriceId(priceId);
  if (!plan) {
    logger.error('Price de Stripe sin plan asociado', { priceId, id: subscription?.id });
    return;
  }

  // Stripe da el fin de periodo en segundos.
  const periodEndSeconds =
    subscription?.items?.data?.[0]?.current_period_end ?? subscription?.current_period_end;

  await Subscription.findOneAndUpdate(
    { workspaceId },
    {
      $set: {
        plan,
        status: subscription.status,
        stripeSubscriptionId: subscription.id,
        stripeCustomerId:
          typeof subscription.customer === 'string'
            ? subscription.customer
            : subscription.customer?.id,
        currentPeriodEnd: periodEndSeconds ? new Date(periodEndSeconds * 1000) : null,
        cancelAtPeriodEnd: Boolean(subscription.cancel_at_period_end),
      },
    },
    { upsert: true },
  );

  logger.info('Suscripción actualizada', { workspaceId, plan, status: subscription.status });
}

/** Degrada el workspace al plan por defecto cuando se cancela la suscripción. */
export async function cancelSubscription(subscription) {
  await connectToDatabase();
  const workspaceId = await resolveWorkspaceId(subscription);
  if (!workspaceId) return;

  await Subscription.findOneAndUpdate(
    { workspaceId },
    { $set: { plan: 'FREE', status: subscription.status ?? 'canceled', cancelAtPeriodEnd: false } },
  );
  logger.info('Suscripción cancelada', { workspaceId });
}

/** Planes visibles en la página de precios. */
export function listPlans() {
  return Object.values(PLANS);
}
