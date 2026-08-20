'use client';

import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { toast } from 'sonner';
import Link from 'next/link';
import { loginSchema } from '@/lib/validation/auth';
import { loginAction } from '../actions';
import { Input } from '@/components/ui/Input';
import { PasswordInput } from '@/components/auth/PasswordInput';
import { FormError } from '@/components/ui/FormError';
import { applyFieldErrors } from '@/lib/forms/apply-field-errors';

const submitBtn =
  'press flex h-11 w-full items-center justify-center rounded-xl bg-accent text-accent-fg text-sm font-semibold hover:bg-accent/90 mac-disabled';

export function LoginForm() {
  const {
    register,
    handleSubmit,
    setError,
    formState: { errors, isSubmitting },
  } = useForm({
    resolver: zodResolver(loginSchema),
    defaultValues: { email: '', password: '' },
  });

  async function onSubmit(values) {
    const result = await loginAction(values);
    if (result?.ok === false) {
      if (result.fieldErrors) applyFieldErrors(setError, result.fieldErrors);
      else toast.error(result.message);
    }
  }

  return (
    <form onSubmit={handleSubmit(onSubmit)} noValidate className="space-y-3">
      <div>
        <Input
          type="email"
          autoComplete="email"
          placeholder="Email"
          className="h-11 rounded-xl px-4 text-sm"
          {...register('email')}
        />
        <FormError message={errors.email?.message} />
      </div>
      <div>
        <PasswordInput
          autoComplete="current-password"
          placeholder="Contraseña"
          {...register('password')}
        />
        <FormError message={errors.password?.message} />
      </div>
      <button type="submit" disabled={isSubmitting} className={submitBtn}>
        {isSubmitting ? 'Entrando…' : 'Iniciar sesión'}
      </button>
      <p className="pt-1 text-center text-xs">
        <Link href="/forgot" className="text-secondary hover:text-primary">
          ¿Has olvidado tu contraseña?
        </Link>
      </p>
      <p className="text-secondary text-center text-xs">
        ¿No tienes cuenta?{' '}
        <Link href="/signup" className="text-accent font-medium">
          Crea una
        </Link>
      </p>
    </form>
  );
}

export default LoginForm;
