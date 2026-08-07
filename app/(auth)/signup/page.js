import { SignupForm } from './SignupForm';

export const metadata = { title: 'Crear cuenta · Silmari' };

export default function SignupPage() {
  return (
    <div>
      <h1 className="text-primary mb-1 text-base font-semibold">Continúa con tu email</h1>
      <p className="text-secondary mb-6 text-xs">Crea tu cuenta para empezar</p>
      <SignupForm />
    </div>
  );
}
