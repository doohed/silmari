import Link from 'next/link';
import { Mail } from 'lucide-react';
import { BrandMark } from '@/components/ui/BrandMark';
import { GoogleIcon, MicrosoftIcon } from '@/components/auth/ProviderIcons';
import { isGoogleConfigured } from '@/lib/auth/oauth/google';
import { appName } from '@/lib/config/app';

export const metadata = { title: 'Bienvenido · Silmari' };

const btn =
  'press flex h-11 w-full items-center justify-center gap-3 rounded-xl border text-sm font-semibold';

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
        <h1 className="text-primary mt-10 text-2xl font-semibold tracking-tight">
          Bienvenido a {brand}
        </h1>

        {error && ERRORS[error] && (
          <p className="bg-chip-red text-chip-red-fg mt-6 w-full rounded-lg px-3 py-2 text-xs">
            {ERRORS[error]}
          </p>
        )}

        <div className="stagger mt-10 w-full space-y-3">
          {googleReady ? (
            <a href="/api/auth/google" className={`${btn} bg-surface border-border shadow-sm`}>
              <GoogleIcon size={18} /> Continuar con Google
            </a>
          ) : (
            <span
              className={`${btn} bg-surface border-border text-tertiary cursor-not-allowed opacity-60`}
              title="Configura GOOGLE_CLIENT_ID y GOOGLE_CLIENT_SECRET"
            >
              <GoogleIcon size={18} /> Continuar con Google
            </span>
          )}

          <span
            className={`${btn} bg-surface border-border text-tertiary cursor-not-allowed opacity-60`}
            title="Próximamente"
          >
            <MicrosoftIcon size={16} /> Continuar con Microsoft
          </span>

          <div className="flex items-center gap-3 py-1">
            <span className="bg-border h-px flex-1" />
            <span className="text-tertiary text-xs">o</span>
            <span className="bg-border h-px flex-1" />
          </div>

          <Link href="/signup" className={`${btn} border-border text-primary hover:bg-chip-gray`}>
            <Mail size={16} /> Continuar con email
          </Link>
        </div>

        <p className="text-tertiary mt-10 text-xs leading-relaxed">
          Al usar {brand} aceptas los Términos del servicio y el Acuerdo de tratamiento de datos.
        </p>
        <p className="text-tertiary mt-4 text-xs">
          ¿Ya tienes cuenta?{' '}
          <Link href="/login" className="text-accent font-medium">
            Inicia sesión
          </Link>
        </p>
      </div>
    </main>
  );
}
