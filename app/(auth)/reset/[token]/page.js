import Link from 'next/link';
import { isResetTokenValid } from '@/lib/accounts/password-reset';
import { ResetForm } from './ResetForm';

export const metadata = { title: 'Nueva contraseña · Silmari' };

/**
 * El token viaja en la URL. Se comprueba en servidor **sin gastarlo**, para no
 * enseñar el formulario de un enlace caducado y que el usuario descubra el
 * problema después de escribir la contraseña.
 */
export default async function ResetPasswordPage({ params }) {
  const { token } = await params;
  const valid = await isResetTokenValid(token);

  if (!valid) {
    return (
      <div className="space-y-4 text-center">
        <h1 className="text-primary text-2xl font-semibold tracking-tight">Enlace no válido</h1>
        <p className="text-secondary text-sm">
          Este enlace ha caducado o ya se ha usado. Los enlaces duran una hora y solo sirven una
          vez.
        </p>
        <Link href="/forgot" className="text-accent inline-block text-sm">
          Pedir uno nuevo
        </Link>
      </div>
    );
  }

  return (
    <div>
      <h1 className="text-primary mb-8 text-center text-2xl font-semibold tracking-tight">
        Nueva contraseña
      </h1>
      <ResetForm token={token} />
    </div>
  );
}
