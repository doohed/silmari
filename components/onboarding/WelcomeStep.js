'use client';

import { useTransition } from 'react';
import { toast } from 'sonner';
import { BrandMark } from '@/components/ui/BrandMark';
import { Button } from '@/components/ui/Button';
import { finishAction } from '@/app/onboarding/actions';

/** Paso 5 del onboarding: animación de bienvenida con el nombre del usuario. */
export function WelcomeStep({ firstName, brand }) {
  const [pending, startTransition] = useTransition();

  function enter() {
    startTransition(async () => {
      const r = await finishAction();
      if (r?.ok === false) toast.error(r.message);
    });
  }

  return (
    <div className="mx-auto flex w-full max-w-md flex-col items-center text-center">
      <div className="relative">
        <span className="bg-accent/20 anim-pop absolute inset-0 -z-10 scale-150 rounded-full blur-2xl" />
        <span className="anim-pop inline-block">
          <BrandMark size={64} />
        </span>
      </div>

      <h1 className="anim-fade-up text-primary mt-8 text-2xl font-semibold tracking-tight">
        ¡Todo listo{firstName ? `, ${firstName}` : ''}!
      </h1>
      <p className="anim-fade-up text-secondary mt-3 text-sm">
        Tu espacio de trabajo está preparado. Bienvenido a {brand}.
      </p>

      <Button type="button" onClick={enter} disabled={pending} className="anim-fade-up mt-10 px-8">
        {pending ? 'Entrando…' : `Entrar a ${brand}`}
      </Button>
    </div>
  );
}

export default WelcomeStep;
