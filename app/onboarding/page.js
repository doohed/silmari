import { redirect } from 'next/navigation';
import { requireContext } from '@/lib/auth/dal';
import { getOnboardingState } from '@/lib/onboarding/service';
import { getSubscription, listPlans } from '@/lib/billing/service';
import { appName } from '@/lib/config/app';
import { WorkspaceStep } from '@/components/onboarding/WorkspaceStep';
import { ProfileStep } from '@/components/onboarding/ProfileStep';
import { InviteStep } from '@/components/onboarding/InviteStep';
import { PlanStep } from '@/components/onboarding/PlanStep';
import { WelcomeStep } from '@/components/onboarding/WelcomeStep';

export const metadata = { title: 'Configura tu cuenta · Silmari' };

const PROGRESS = ['WORKSPACE', 'PROFILE', 'INVITE', 'PLAN'];

export default async function OnboardingPage({ searchParams }) {
  const ctx = await requireContext();
  const state = await getOnboardingState(ctx);

  if (state.step === 'DONE') redirect('/');

  // El paso del plan necesita saber qué se ha contratado ya: Stripe devuelve
  // aquí al usuario tras el Checkout, con `?estado=ok`.
  const billing = state.step === 'PLAN' ? await getSubscription(ctx) : null;
  const { estado } = (await searchParams) ?? {};

  return (
    <div className="w-full">
      {PROGRESS.includes(state.step) && <StepDots step={state.step} />}
      {renderStep(state, { billing, paymentState: estado })}
    </div>
  );
}

function renderStep(state, { billing, paymentState }) {
  switch (state.step) {
    case 'WORKSPACE':
      return <WorkspaceStep initial={state.workspace} appDomain={state.appDomain} />;
    case 'PROFILE':
      return <ProfileStep initial={state.user} />;
    case 'INVITE':
      return <InviteStep />;
    case 'PLAN':
      return (
        <PlanStep
          plans={listPlans()}
          currentPlan={billing.plan}
          configured={billing.configured}
          paymentState={paymentState}
        />
      );
    case 'WELCOME':
      return <WelcomeStep firstName={state.user.firstName} brand={appName()} />;
    default:
      return null;
  }
}

/** Indicador de progreso (puntos) para los pasos con formulario. */
function StepDots({ step }) {
  const idx = PROGRESS.indexOf(step);
  return (
    <div className="mx-auto mb-8 flex w-full max-w-md items-center gap-2">
      {PROGRESS.map((s, i) => (
        <span
          key={s}
          className={`h-1.5 flex-1 rounded-full transition-colors ${
            i <= idx ? 'bg-accent' : 'bg-border'
          }`}
        />
      ))}
    </div>
  );
}
