'use client';

import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { toast } from 'sonner';
import Link from 'next/link';
import { loginSchema } from '@/lib/validation/auth';
import { loginAction } from '../actions';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Label } from '@/components/ui/Label';
import { FormError } from '@/components/ui/FormError';
import { applyFieldErrors } from '@/lib/forms/apply-field-errors';

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
    <form onSubmit={handleSubmit(onSubmit)} noValidate className="space-y-4">
      <div>
        <Label htmlFor="email">Email</Label>
        <Input id="email" type="email" autoComplete="email" {...register('email')} />
        <FormError message={errors.email?.message} />
      </div>
      <div>
        <Label htmlFor="password">Contraseña</Label>
        <Input
          id="password"
          type="password"
          autoComplete="current-password"
          {...register('password')}
        />
        <FormError message={errors.password?.message} />
      </div>
      <Button type="submit" disabled={isSubmitting} className="w-full">
        {isSubmitting ? 'Entrando…' : 'Iniciar sesión'}
      </Button>
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
