'use client';

import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { toast } from 'sonner';
import Link from 'next/link';
import { resetPasswordSchema } from '@/lib/validation/auth';
import { resetPasswordAction } from '../../actions';
import { PasswordInput } from '@/components/auth/PasswordInput';
import { FormError } from '@/components/ui/FormError';
import { applyFieldErrors } from '@/lib/forms/apply-field-errors';

const submitBtn =
  'press flex h-11 w-full items-center justify-center rounded-xl bg-accent text-accent-fg text-sm font-semibold hover:bg-accent/90 disabled:opacity-60';

/** @param {{ token: string }} props */
export function ResetForm({ token }) {
  const [done, setDone] = useState(false);
  const {
    register,
    handleSubmit,
    setError,
    formState: { errors, isSubmitting },
  } = useForm({
    resolver: zodResolver(resetPasswordSchema),
    defaultValues: { token, password: '' },
  });

  async function onSubmit(values) {
    const result = await resetPasswordAction(values);
    if (result?.ok === false) {
      if (result.fieldErrors) applyFieldErrors(setError, result.fieldErrors);
      else toast.error(result.message);
      return;
    }
    setDone(true);
  }

  if (done) {
    return (
      <div className="space-y-4 text-center">
        <p className="text-primary text-sm">Tu contraseña se ha actualizado.</p>
        <Link href="/login" className={submitBtn}>
          Iniciar sesión
        </Link>
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit(onSubmit)} noValidate className="space-y-3">
      <p className="text-secondary mb-4 text-sm">Elige una contraseña nueva para tu cuenta.</p>
      <input type="hidden" {...register('token')} />
      <div>
        <PasswordInput
          autoComplete="new-password"
          placeholder="Contraseña nueva"
          {...register('password')}
        />
        <FormError message={errors.password?.message} />
      </div>
      <button type="submit" disabled={isSubmitting} className={submitBtn}>
        {isSubmitting ? 'Guardando…' : 'Guardar contraseña'}
      </button>
    </form>
  );
}
