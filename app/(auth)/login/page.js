import { LoginForm } from './LoginForm';

export const metadata = { title: 'Iniciar sesión · Silmari' };

export default function LoginPage() {
  return (
    <div>
      <h1 className="text-primary mb-1 text-base font-semibold">Inicia sesión</h1>
      <p className="text-secondary mb-6 text-xs">Accede a tu espacio de trabajo</p>
      <LoginForm />
    </div>
  );
}
