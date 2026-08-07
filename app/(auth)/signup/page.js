import { SignupForm } from './SignupForm';

export const metadata = { title: 'Crear cuenta · Silmari' };

export default async function SignupPage({ searchParams }) {
  const { email } = (await searchParams) ?? {};
  return (
    <div>
      <h1 className="text-primary mb-8 text-center text-2xl font-semibold tracking-tight">
        Crea tu cuenta
      </h1>
      <SignupForm defaultEmail={typeof email === 'string' ? email : ''} />
    </div>
  );
}
