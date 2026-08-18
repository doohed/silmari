'use client';

import { useState, useTransition } from 'react';
import { Check, CreditCard } from 'lucide-react';
import { toast } from 'sonner';
import { completePlanAction, onboardingCheckoutAction } from '@/app/onboarding/actions';
import { RESOURCE_LABELS } from '@/lib/billing/plans';
import { StepFrame } from './StepFrame';
import { Button } from '@/components/ui/Button';

/**
 * Paso 4 del onboarding: elegir plan.
 *
 * Antes era una pantalla decorativa con campos de tarjeta falsos. Se quitaron a
 * propósito: un formulario de tarjeta que no cobra invita a teclear un número
 * real en un input que no cifra nada. Ahora, o se sigue en el plan gratuito, o
 * se abre el Checkout de Stripe, que es quien toca la tarjeta.
 *
 * @param {{ plans: Array<object>, currentPlan: string, configured: boolean, paymentState?: string }} props
 */
export function PlanStep({ plans, currentPlan, configured, paymentState }) {
  const [pending, startTransition] = useTransition();
  const [opening, setOpening] = useState('');

  function cont() {
    startTransition(async () => {
      const r = await completePlanAction();
      if (r?.ok === false) toast.error(r.message);
    });
  }

  async function checkout(plan) {
    setOpening(plan);
    const r = await onboardingCheckoutAction({ plan });
    setOpening('');
    if (!r.ok) return toast.error(r.message);
    window.location.assign(r.data.url);
  }

  const paid = plans.filter((p) => p.key !== 'FREE');
  const free = plans.find((p) => p.key === 'FREE');

  return (
    <StepFrame
      title="Elige tu plan"
      subtitle="Puedes empezar gratis y cambiarlo cuando quieras desde Ajustes"
    >
      {paymentState === 'ok' && (
        <p className="border-border bg-chip-green text-primary mb-4 rounded-lg border px-3 py-2 text-xs">
          Pago confirmado. Si el plan todavía aparece como gratuito, dale unos segundos: lo confirma
          Stripe por su cuenta.
        </p>
      )}
      {paymentState === 'cancelado' && (
        <p className="border-border bg-chip-gray text-secondary mb-4 rounded-lg border px-3 py-2 text-xs">
          No se ha completado el pago. Puedes seguir con el plan gratuito.
        </p>
      )}

      {free && (
        <div className="border-border bg-surface rounded-lg border p-4">
          <div className="flex items-center justify-between">
            <p className="text-primary text-sm font-semibold">
              {free.label} <span className="text-tertiary font-normal">· sin tarjeta</span>
            </p>
            {currentPlan === 'FREE' && <span className="text-tertiary text-xs">Plan actual</span>}
          </div>
          <ul className="mt-3 space-y-1">
            {Object.entries(free.limits).map(([resource, max]) => (
              <li key={resource} className="text-secondary flex items-center gap-1.5 text-xs">
                <Check size={12} className="text-accent shrink-0" />
                {max === null ? 'Sin límite de ' : `${max} `}
                {RESOURCE_LABELS[resource] ?? resource}
              </li>
            ))}
          </ul>
        </div>
      )}

      {configured && (
        <div className="mt-3 space-y-3">
          {paid.map((plan) => (
            <div key={plan.key} className="border-border bg-surface rounded-lg border p-4">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <p className="text-primary text-sm font-semibold">{plan.label}</p>
                  <p className="text-tertiary text-xs">
                    {plan.priceMonthly} € al mes · impuestos aparte
                  </p>
                </div>
                {currentPlan === plan.key ? (
                  <span className="text-tertiary shrink-0 text-xs">Plan actual</span>
                ) : (
                  <Button
                    size="sm"
                    variant="secondary"
                    onClick={() => checkout(plan.key)}
                    disabled={Boolean(opening) || pending}
                  >
                    <CreditCard size={13} />
                    {opening === plan.key ? 'Abriendo…' : 'Contratar'}
                  </Button>
                )}
              </div>
              <ul className="mt-3 space-y-1">
                {Object.entries(plan.limits).map(([resource, max]) => (
                  <li key={resource} className="text-secondary flex items-center gap-1.5 text-xs">
                    <Check size={12} className="text-accent shrink-0" />
                    {max === null ? 'Sin límite de ' : `${max} `}
                    {RESOURCE_LABELS[resource] ?? resource}
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>
      )}

      <Button
        type="button"
        onClick={cont}
        disabled={pending || Boolean(opening)}
        className="mt-6 w-full"
      >
        {pending ? 'Continuando…' : currentPlan === 'FREE' ? 'Continuar gratis' : 'Continuar'}
      </Button>
    </StepFrame>
  );
}

export default PlanStep;
