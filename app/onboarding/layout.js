import { requireContext } from '@/lib/auth/dal';
import { BrandMark } from '@/components/ui/BrandMark';
import { onboardingLogoutAction } from './actions';

/** Shell del onboarding: cromo mínimo (logo + cerrar sesión) y contenido centrado. */
export default async function OnboardingLayout({ children }) {
  await requireContext();
  return (
    <div className="flex min-h-screen flex-col">
      <header className="flex h-14 shrink-0 items-center justify-between px-5">
        <BrandMark size={28} />
        <form action={onboardingLogoutAction}>
          <button
            type="submit"
            className="press text-tertiary hover:text-primary text-xs transition-colors"
          >
            Cerrar sesión
          </button>
        </form>
      </header>
      <main className="grid flex-1 place-items-center px-4 py-8">{children}</main>
    </div>
  );
}
