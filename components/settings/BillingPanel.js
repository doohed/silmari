'use client';

import { useState } from 'react';
import { toast } from 'sonner';
import { Check } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { RESOURCE_LABELS } from '@/lib/billing/plans';
import { createCheckoutAction, createPortalAction } from '@/app/(workspace)/settings/actions';

/**
 * Plan actual, consumo frente a los límites y acceso al Checkout / portal de
 * Stripe. La gestión de tarjeta, facturas y cancelación no se replica aquí: se
 * delega en el portal de Stripe.
 *
 * @param {{ subscription: object, usage: Record<string, number>, plans: Array<object>, canManage: boolean }} props
 */
export function BillingPanel({ subscription, usage, plans, canManage }) {
  const [pending, setPending] = useState('');

  async function checkout(plan) {
    setPending(plan);
    const r = await createCheckoutAction({ plan });
    setPending('');
    if (!r.ok) return toast.error(r.message);
    window.location.assign(r.data.url);
  }

  async function portal() {
    setPending('portal');
    const r = await createPortalAction();
    setPending('');
    if (!r.ok) return toast.error(r.message);
    window.location.assign(r.data.url);
  }

  const isPaid = subscription.plan !== 'FREE';

  return (
    <div className="space-y-6">
      <div className="border-border bg-surface rounded-lg border p-4">
        <div className="flex items-start justify-between gap-3">
          <div>
            <p className="text-tertiary text-xs">Plan actual</p>
            <p className="text-primary text-lg font-semibold">{subscription.planLabel}</p>
            {subscription.cancelAtPeriodEnd && subscription.currentPeriodEnd && (
              <p className="text-secondary mt-1 text-xs">
                Se cancelará el{' '}
                {new Date(subscription.currentPeriodEnd).toLocaleDateString('es-ES')}
              </p>
            )}
            {subscription.status === 'past_due' && (
              <p className="text-danger mt-1 text-xs">
                Hay un pago pendiente. Actualiza tu método de pago para no perder el plan.
              </p>
            )}
          </div>
          {isPaid && canManage && subscription.configured && (
            <Button size="sm" variant="secondary" onClick={portal} disabled={pending === 'portal'}>
              {pending === 'portal' ? 'Abriendo…' : 'Gestionar suscripción'}
            </Button>
          )}
        </div>

        <ul className="border-border mt-4 space-y-2 border-t pt-4">
          {Object.entries(subscription.limits).map(([resource, max]) => (
            <li key={resource} className="flex items-center justify-between text-xs">
              <span className="text-secondary">{RESOURCE_LABELS[resource] ?? resource}</span>
              <span className="text-primary font-medium">
                {usage[resource] ?? 0}
                {max === null ? ' · sin límite' : ` de ${max}`}
              </span>
            </li>
          ))}
        </ul>
      </div>

      {!subscription.configured && (
        <p className="border-border bg-chip-yellow text-primary rounded-lg border px-3 py-2 text-xs">
          La facturación no está configurada en este entorno: falta <code>STRIPE_SECRET_KEY</code>.
          Los planes se muestran, pero no se puede contratar.
        </p>
      )}

      <div className="grid gap-3 sm:grid-cols-3">
        {plans.map((plan) => {
          const current = plan.key === subscription.plan;
          return (
            <div
              key={plan.key}
              className={`rounded-lg border p-4 ${
                current ? 'border-accent bg-surface' : 'border-border bg-surface'
              }`}
            >
              <p className="text-primary text-sm font-semibold">{plan.label}</p>
              <p className="text-primary mt-1 text-2xl font-semibold">
                {plan.priceMonthly === 0 ? 'Gratis' : `${plan.priceMonthly} €`}
                {plan.priceMonthly > 0 && (
                  <span className="text-tertiary text-xs font-normal"> /mes</span>
                )}
              </p>
              <ul className="mt-3 space-y-1">
                {Object.entries(plan.limits).map(([resource, max]) => (
                  <li key={resource} className="text-secondary flex items-center gap-1.5 text-xs">
                    <Check size={12} className="text-accent shrink-0" />
                    {max === null ? 'Sin límite de ' : `${max} `}
                    {RESOURCE_LABELS[resource] ?? resource}
                  </li>
                ))}
              </ul>
              {current ? (
                <p className="text-tertiary mt-4 text-center text-xs">Plan actual</p>
              ) : (
                plan.key !== 'FREE' &&
                canManage &&
                subscription.configured && (
                  <Button
                    size="sm"
                    className="mt-4 w-full"
                    onClick={() => checkout(plan.key)}
                    disabled={Boolean(pending)}
                  >
                    {pending === plan.key ? 'Abriendo…' : 'Elegir plan'}
                  </Button>
                )
              )}
            </div>
          );
        })}
      </div>

      {!canManage && (
        <p className="text-tertiary text-xs">
          Solo el propietario del espacio de trabajo puede cambiar el plan.
        </p>
      )}
    </div>
  );
}

export default BillingPanel;
