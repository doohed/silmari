import { redirect } from 'next/navigation';
import { requireContext } from '@/lib/auth/dal';
import { getOnboardingState } from '@/lib/onboarding/service';
import { appName } from '@/lib/config/app';
import { WorkspaceStep } from '@/components/onboarding/WorkspaceStep';
import { ProfileStep } from '@/components/onboarding/ProfileStep';
import { InviteStep } from '@/components/onboarding/InviteStep';
import { PlanStep } from '@/components/onboarding/PlanStep';
import { WelcomeStep } from '@/components/onboarding/WelcomeStep';

export const metadata = { title: 'Configura tu cuenta · Silmari' };

const PROGRESS = ['WORKSPACE', 'PROFILE', 'INVITE', 'PLAN'];

export default async function OnboardingPage() {
  const ctx = await requireContext();
  const state = await getOnboardingState(ctx);

  if (state.step === 'DONE') redirect('/');

  return (
    <div className="w-full">
      {PROGRESS.includes(state.step) && <StepDots step={state.step} />}
      {renderStep(state)}
    </div>
  );
}

function renderStep(state) {
  switch (state.step) {
    case 'WORKSPACE':
      return <WorkspaceStep initial={state.workspace} appDomain={state.appDomain} />;
    case 'PROFILE':
      return <ProfileStep initial={state.user} />;
    case 'INVITE':
      return <InviteStep />;
    case 'PLAN':
      return <PlanStep />;
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
