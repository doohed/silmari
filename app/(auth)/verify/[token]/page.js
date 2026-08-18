import Link from 'next/link';
import { CheckCircle2, XCircle } from 'lucide-react';
import { verifyEmailToken } from '@/lib/accounts/email-verification';

export const metadata = { title: 'Confirmar email · Silmari' };

/**
 * Consume el token al entrar. Es una acción con efecto en un GET, cosa que
 * normalmente evitaríamos, pero es lo que hace un enlace de correo: la
 * alternativa (un botón que confirma) añade un paso sin ganar nada, porque el
 * token ya viaja en la URL.
 */
export default async function VerifyEmailPage({ params }) {
  const { token } = await params;

  let ok = false;
  let message = '';
  try {
    await verifyEmailToken(token);
    ok = true;
  } catch (err) {
    message = err?.message ?? 'El enlace no es válido.';
  }

  return (
    <div className="space-y-4 text-center">
      {ok ? (
        <CheckCircle2 className="text-success mx-auto" size={40} />
      ) : (
        <XCircle className="text-danger mx-auto" size={40} />
      )}
      <h1 className="text-primary text-2xl font-semibold tracking-tight">
        {ok ? 'Email confirmado' : 'No hemos podido confirmarlo'}
      </h1>
      <p className="text-secondary text-sm">
        {ok ? 'Tu dirección ya está verificada. Puedes seguir usando Silmari.' : message}
      </p>
      <Link href={ok ? '/' : '/login'} className="text-accent inline-block text-sm">
        {ok ? 'Ir a la app' : 'Volver al inicio de sesión'}
      </Link>
    </div>
  );
}
