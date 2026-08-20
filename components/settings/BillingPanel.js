'use client';

import { useState } from 'react';
import { toast } from 'sonner';
import { Check } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { SettingsGroup, SettingsRow } from '@/components/ui/SettingsGroup';
import { RESOURCE_LABELS } from '@/lib/billing/plans';
import { createCheckoutAction, createPortalAction } from '@/app/(workspace)/settings/actions';

/**
 * Plan actual, consumo frente a los límites y cambio de suscripción.
 *
 * El consumo va como una **fila por recurso** ("registros … 204 de 1000") en vez
 * de una tabla dentro de una tarjeta: es exactamente la forma que tiene una
 * lista agrupada, y así se lee igual que el resto de Ajustes.
 *
 * Los planes también son filas y no tres tarjetas en rejilla. La rejilla es de
 * una página de precios, donde hay que comparar y decidir; aquí ya eres cliente
 * y lo único que haces es mirar en cuál estás y, como mucho, subir.
 *
 * La gestión de tarjeta, facturas y cancelación no se replica: se delega en el
 * portal de Stripe.
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
  const cancelsOn =
    subscription.cancelAtPeriodEnd && subscription.currentPeriodEnd
      ? new Date(subscription.currentPeriodEnd).toLocaleDateString('es-ES')
      : null;

  return (
    <div>
      <SettingsGroup>
        <SettingsRow
          label="Plan actual"
          hint={cancelsOn ? `Se cancelará el ${cancelsOn}` : undefined}
        >
          <span className="text-primary text-[13px] font-medium">{subscription.planLabel}</span>
        </SettingsRow>

        {subscription.status === 'past_due' && (
          <SettingsRow
            label="Pago pendiente"
            hint="Actualiza tu método de pago para no perder el plan"
          >
            <span className="bg-chip-red text-chip-red-fg rounded-full px-2 py-0.5 text-xs">
              Atención
            </span>
          </SettingsRow>
        )}

        {isPaid && canManage && subscription.configured && (
          <SettingsRow label="Suscripción" hint="Tarjeta, facturas y cancelación, en Stripe">
            <Button size="md" variant="secondary" onClick={portal} disabled={pending === 'portal'}>
              {pending === 'portal' ? 'Abriendo…' : 'Gestionar'}
            </Button>
          </SettingsRow>
        )}
      </SettingsGroup>

      <SettingsGroup title="Consumo">
        {Object.entries(subscription.limits).map(([resource, max]) => (
          <SettingsRow key={resource} label={RESOURCE_LABELS[resource] ?? resource}>
            <span className="text-secondary text-[13px] tabular-nums">
              {usage[resource] ?? 0}
              {max === null ? ' · sin límite' : ` de ${max}`}
            </span>
          </SettingsRow>
        ))}
      </SettingsGroup>

      <SettingsGroup
        title="Planes"
        footnote={
          !subscription.configured
            ? 'La facturación no está configurada en este entorno: falta STRIPE_SECRET_KEY. Los planes se muestran, pero no se puede contratar.'
            : !canManage
              ? 'Solo el propietario del espacio de trabajo puede cambiar el plan.'
              : undefined
        }
      >
        {plans.map((plan) => {
          const current = plan.key === subscription.plan;
          // El plan gratuito se llama "Gratis" y cuesta "Gratis": repetirlo en la
          // misma línea quedaba como un error.
          const label =
            plan.priceMonthly === 0 ? plan.label : `${plan.label} · ${plan.priceMonthly} € al mes`;
          return (
            <SettingsRow key={plan.key} stacked label={label}>
              <div className="flex items-start justify-between gap-4">
                <ul className="flex min-w-0 flex-wrap gap-x-4 gap-y-1">
                  {Object.entries(plan.limits).map(([resource, max]) => (
                    <li key={resource} className="text-secondary flex items-center gap-1.5 text-xs">
                      <Check size={12} className="text-accent shrink-0" aria-hidden />
                      {max === null ? 'Sin límite de ' : `${max} `}
                      {RESOURCE_LABELS[resource] ?? resource}
                    </li>
                  ))}
                </ul>
                <div className="shrink-0">
                  {current ? (
                    <span className="bg-chip-gray text-chip-gray-fg rounded-full px-2 py-0.5 text-xs">
                      Plan actual
                    </span>
                  ) : (
                    plan.key !== 'FREE' &&
                    canManage &&
                    subscription.configured && (
                      <Button
                        size="sm"
                        onClick={() => checkout(plan.key)}
                        disabled={Boolean(pending)}
                      >
                        {pending === plan.key ? 'Abriendo…' : 'Elegir'}
                      </Button>
                    )
                  )}
                </div>
              </div>
            </SettingsRow>
          );
        })}
      </SettingsGroup>
    </div>
  );
}

export default BillingPanel;
