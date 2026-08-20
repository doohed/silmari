'use client';

import { useRef, useState } from 'react';
import Link from 'next/link';
import { toast } from 'sonner';
import { Mail } from 'lucide-react';
import { cn } from '@/lib/utils/cn';
import { Input } from '@/components/ui/Input';
import { PasswordInput } from '@/components/auth/PasswordInput';
import { GoogleIcon, MicrosoftIcon } from '@/components/auth/ProviderIcons';
import { loginAction } from '@/app/(auth)/actions';

const providerBtn =
  'press flex h-11 w-full items-center justify-center gap-3 rounded-xl border text-sm font-semibold';

/** Toast rojo para errores de credenciales. */
function redToast(message) {
  toast.error(message, {
    style: {
      background: 'var(--danger)',
      color: '#fff',
      border: '1px solid color-mix(in oklab, var(--danger) 80%, black)',
    },
  });
}

/**
 * Puerta de entrada progresiva estilo Twenty: proveedores → email → contraseña,
 * revelando cada campo con una animación de "salir desde detrás".
 * @param {{ googleReady: boolean, microsoftReady: boolean, brand: string }} props
 */
export function WelcomeGate({ googleReady, microsoftReady, brand }) {
  const [stage, setStage] = useState('providers'); // 'providers' | 'email' | 'password'
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [errored, setErrored] = useState(false);
  const [loading, setLoading] = useState(false);
  const pwRef = useRef(null);
  const emailRef = useRef(null);

  const emailValid = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim());

  function openEmail() {
    setStage('email');
    requestAnimationFrame(() => emailRef.current?.focus());
  }

  function continueEmail() {
    if (!emailValid) return redToast('Introduce un email válido');
    setStage('password');
    requestAnimationFrame(() => pwRef.current?.focus());
  }

  async function signIn() {
    if (!password) return redToast('Introduce tu contraseña');
    setLoading(true);
    const result = await loginAction({ email: email.trim(), password });
    setLoading(false);
    // En éxito la acción redirige y no retorna; solo llegamos aquí si falla.
    if (result?.ok === false) {
      redToast('Contraseña incorrecta');
      setErrored(true);
      pwRef.current?.focus();
    }
  }

  const signupHref = email.trim() ? `/signup?email=${encodeURIComponent(email.trim())}` : '/signup';

  return (
    <div className="w-full">
      {/* Proveedores OAuth (siempre visibles) */}
      <div className="stagger space-y-3">
        {googleReady ? (
          <a
            href="/api/auth/google"
            className={cn(providerBtn, 'bg-surface border-border shadow-sm')}
          >
            <GoogleIcon size={18} /> Continuar con Google
          </a>
        ) : (
          <span
            className={cn(
              providerBtn,
              'bg-surface border-border text-tertiary cursor-not-allowed opacity-60',
            )}
            title="Configura GOOGLE_CLIENT_ID y GOOGLE_CLIENT_SECRET"
          >
            <GoogleIcon size={18} /> Continuar con Google
          </span>
        )}

        {microsoftReady ? (
          <a
            href="/api/auth/microsoft"
            className={cn(providerBtn, 'bg-surface border-border shadow-sm')}
          >
            <MicrosoftIcon size={16} /> Continuar con Microsoft
          </a>
        ) : (
          <span
            className={cn(
              providerBtn,
              'bg-surface border-border text-tertiary cursor-not-allowed opacity-60',
            )}
            title="Configura MICROSOFT_CLIENT_ID y MICROSOFT_CLIENT_SECRET"
          >
            <MicrosoftIcon size={16} /> Continuar con Microsoft
          </span>
        )}

        <div className="flex items-center gap-3 py-1">
          <span className="bg-border h-px flex-1" />
          <span className="text-tertiary text-xs">o</span>
          <span className="bg-border h-px flex-1" />
        </div>
      </div>

      {/* Disparador de email (se sustituye por el campo al abrirlo) */}
      {stage === 'providers' && (
        <button
          type="button"
          onClick={openEmail}
          className={cn(providerBtn, 'border-border text-primary hover:bg-chip-gray mt-3')}
        >
          <Mail size={16} /> Continuar con email
        </button>
      )}

      {/* Campo de email revelado */}
      {stage !== 'providers' && (
        <div className="auth-reveal mt-3 space-y-3">
          <Input
            ref={emailRef}
            type="email"
            inputMode="email"
            autoComplete="email"
            placeholder="Email"
            className="h-11 rounded-xl px-4 text-sm"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && stage === 'email') continueEmail();
            }}
          />
          {stage === 'email' && (
            <button
              type="button"
              onClick={continueEmail}
              className={cn(providerBtn, 'bg-accent text-accent-fg hover:bg-accent/90')}
            >
              Continuar
            </button>
          )}
        </div>
      )}

      {/* Campo de contraseña revelado */}
      {stage === 'password' && (
        <div className="auth-reveal mt-3 space-y-3">
          <PasswordInput
            ref={pwRef}
            autoComplete="current-password"
            placeholder="Contraseña"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') signIn();
            }}
          />

          <button
            type="button"
            onClick={signIn}
            disabled={loading}
            className={cn(providerBtn, 'bg-accent text-accent-fg hover:bg-accent/90 mac-disabled')}
          >
            {loading ? 'Entrando…' : 'Iniciar sesión'}
          </button>

          {/* Tras el primer fallo, ofrecer crear cuenta con estas credenciales */}
          {errored && (
            <div className="auth-reveal pt-1 text-center">
              <p className="text-tertiary mb-2 text-xs">¿Aún no tienes cuenta?</p>
              <Link
                href={signupHref}
                className="border-border text-primary hover:bg-chip-gray press inline-flex h-9 items-center justify-center rounded-lg border px-4 text-xs font-semibold"
              >
                Registrarse
              </Link>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

export default WelcomeGate;
