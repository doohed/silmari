import { BrandMark } from '@/components/ui/BrandMark';
import { WelcomeGate } from '@/components/auth/WelcomeGate';
import { isGoogleConfigured } from '@/lib/auth/oauth/google';
import { appName } from '@/lib/config/app';

export const metadata = { title: 'Bienvenido · Silmari' };

const ERRORS = {
  google_not_configured: 'Google no está configurado en este entorno.',
  google_denied: 'Cancelaste el acceso con Google.',
  google_state: 'La sesión de Google caducó. Inténtalo de nuevo.',
  google_failed: 'No se pudo iniciar sesión con Google.',
};

export default async function WelcomePage({ searchParams }) {
  const { error } = (await searchParams) ?? {};
  const googleReady = isGoogleConfigured();
  const brand = appName();

  return (
    <main className="flex flex-1 items-center justify-center px-4 py-12">
      <div className="anim-fade-up flex w-full max-w-sm flex-col items-center text-center">
        <BrandMark size={52} />
        <h1 className="text-primary mt-10 mb-10 text-2xl font-semibold tracking-tight">
          Bienvenido a {brand}
        </h1>

        {error && ERRORS[error] && (
          <p className="bg-chip-red text-chip-red-fg mb-6 w-full rounded-lg px-3 py-2 text-xs">
            {ERRORS[error]}
          </p>
        )}

        <WelcomeGate googleReady={googleReady} brand={brand} />

        <p className="text-tertiary mt-10 text-xs leading-relaxed">
          Al usar {brand} aceptas los Términos del servicio y el Acuerdo de tratamiento de datos.
        </p>
      </div>
    </main>
  );
}
