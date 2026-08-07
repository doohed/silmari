import { LoginForm } from './LoginForm';

export const metadata = { title: 'Iniciar sesión · Silmari' };

export default function LoginPage() {
  return (
    <div>
      <h1 className="text-primary mb-8 text-center text-2xl font-semibold tracking-tight">
        Inicia sesión
      </h1>
      <LoginForm />
    </div>
  );
}
