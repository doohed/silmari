'use client';

import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { toast } from 'sonner';
import Link from 'next/link';
import { emailSignupSchema } from '@/lib/validation/auth';
import { signupAction } from '../actions';
import { Input } from '@/components/ui/Input';
import { PasswordInput } from '@/components/auth/PasswordInput';
import { FormError } from '@/components/ui/FormError';
import { applyFieldErrors } from '@/lib/forms/apply-field-errors';

const submitBtn =
  'press flex h-11 w-full items-center justify-center rounded-xl bg-accent text-accent-fg text-sm font-semibold hover:bg-accent/90 mac-disabled';

export function SignupForm({ defaultEmail = '' }) {
  const {
    register,
    handleSubmit,
    setError,
    formState: { errors, isSubmitting },
  } = useForm({
    resolver: zodResolver(emailSignupSchema),
    defaultValues: { email: defaultEmail, password: '' },
  });

  async function onSubmit(values) {
    const result = await signupAction(values);
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
          autoComplete="new-password"
          placeholder="Contraseña"
          {...register('password')}
        />
        <FormError message={errors.password?.message} />
      </div>
      <button type="submit" disabled={isSubmitting} className={submitBtn}>
        {isSubmitting ? 'Creando…' : 'Continuar'}
      </button>
      <p className="text-secondary pt-1 text-center text-xs">
        ¿Ya tienes cuenta?{' '}
        <Link href="/login" className="text-accent font-medium">
          Inicia sesión
        </Link>
      </p>
    </form>
  );
}

export default SignupForm;
