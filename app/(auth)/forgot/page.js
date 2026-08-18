import { ForgotForm } from './ForgotForm';

export const metadata = { title: 'Recuperar contraseña · Silmari' };

export default function ForgotPasswordPage() {
  return (
    <div>
      <h1 className="text-primary mb-8 text-center text-2xl font-semibold tracking-tight">
        Recuperar contraseña
      </h1>
      <ForgotForm />
    </div>
  );
}
