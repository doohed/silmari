'use client';

import { useState, useTransition } from 'react';
import { Calendar, Check } from 'lucide-react';
import { toast } from 'sonner';
import { completePlanAction, onboardingLogoutAction } from '@/app/onboarding/actions';
import { StepFrame } from './StepFrame';
import { Button } from '@/components/ui/Button';

/**
 * Paso 4 del onboarding: pantalla de "mejora tu prueba" SOLO visual. No captura
 * ni envía datos de tarjeta (los inputs son de solo lectura). La integración
 * real con Stripe se hará detrás de `lib/billing/` en una fase posterior.
 */
export function PlanStep() {
  const [plan, setPlan] = useState('upgraded');
  const [pending, startTransition] = useTransition();

  function cont() {
    startTransition(async () => {
      const r = await completePlanAction();
      if (r?.ok === false) toast.error(r.message);
    });
  }

  return (
    <StepFrame
      title="Mejora tu prueba gratuita"
      subtitle="Añade tus datos de facturación para 30 días de prueba"
    >
      <div className="mb-6 flex flex-wrap gap-2">
        <span className="bg-chip-green text-chip-green-fg flex items-center gap-1.5 rounded-full px-3 py-1 text-xs font-medium">
          <Calendar size={13} /> Prueba ampliada de 30 días
        </span>
      </div>

      <button
        type="button"
        onClick={() => setPlan('upgraded')}
        className={`w-full rounded-lg border p-4 text-left transition-shadow ${
          plan === 'upgraded'
            ? 'border-accent bg-surface shadow-sm'
            : 'border-border bg-surface hover:border-border-strong'
        }`}
      >
        <div className="flex items-center justify-between">
          <p className="text-primary text-sm font-semibold">
            Mejorado <span className="text-tertiary font-normal">· GRATIS</span>
          </p>
          <RadioDot active={plan === 'upgraded'} />
        </div>
        <p className="text-tertiary mt-1 text-xs">
          No se realizará ningún cargo. Recibirás un aviso 7 días antes de que termine.
        </p>

        <div className="mt-4 space-y-3" aria-hidden="true">
          <FakeField label="Número de tarjeta" placeholder="1234 1234 1234 1234" />
          <div className="grid grid-cols-2 gap-3">
            <FakeField label="Caducidad" placeholder="MM / AA" />
            <FakeField label="CVC" placeholder="CVC" />
          </div>
          <FakeField label="País" placeholder="España" />
        </div>
      </button>

      <button
        type="button"
        onClick={() => setPlan('basic')}
        className={`mt-3 flex w-full items-center justify-between rounded-lg border p-4 transition-shadow ${
          plan === 'basic' ? 'border-accent bg-surface shadow-sm' : 'border-border bg-surface'
        }`}
      >
        <p className="text-primary text-sm">
          <span className="font-semibold">Básico</span>{' '}
          <span className="text-tertiary">sin tarjeta</span>
        </p>
        <span className="flex items-center gap-2">
          <span className="text-tertiary text-xs">7 días</span>
          <RadioDot active={plan === 'basic'} />
        </span>
      </button>

      <Button type="button" onClick={cont} disabled={pending} className="mt-6 w-full">
        {pending ? 'Continuando…' : 'Continuar'}
      </Button>

      <form action={onboardingLogoutAction} className="mt-4 text-center">
        <button type="submit" className="press text-tertiary hover:text-secondary text-xs">
          Cerrar sesión
        </button>
      </form>
    </StepFrame>
  );
}

function RadioDot({ active }) {
  return (
    <span
      className={`flex size-4 items-center justify-center rounded-full border ${
        active ? 'border-accent bg-accent text-accent-fg' : 'border-border-strong'
      }`}
    >
      {active && <Check size={11} strokeWidth={3} />}
    </span>
  );
}

function FakeField({ label, placeholder }) {
  return (
    <div>
      <p className="text-secondary mb-1 text-xs">{label}</p>
      <div className="border-border bg-bg text-tertiary flex h-9 items-center rounded-lg border px-3 text-sm">
        {placeholder}
      </div>
    </div>
  );
}

export default PlanStep;
