'use client';

import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { toast } from 'sonner';
import Link from 'next/link';
import { forgotPasswordSchema } from '@/lib/validation/auth';
import { forgotPasswordAction } from '../actions';
import { Input } from '@/components/ui/Input';
import { FormError } from '@/components/ui/FormError';

const submitBtn =
  'press flex h-11 w-full items-center justify-center rounded-xl bg-accent text-accent-fg text-sm font-semibold hover:bg-accent/90 disabled:opacity-60';

export function ForgotForm() {
  const [sent, setSent] = useState(false);
  const {
    register,
    handleSubmit,
    getValues,
    formState: { errors, isSubmitting },
  } = useForm({
    resolver: zodResolver(forgotPasswordSchema),
    defaultValues: { email: '' },
  });

  async function onSubmit(values) {
    const result = await forgotPasswordAction(values);
    if (result?.ok === false) {
      toast.error(result.message);
      return;
    }
    setSent(true);
  }

  // Confirmación deliberadamente ambigua: no revela si el email tiene cuenta.
  if (sent) {
    return (
      <div className="space-y-4 text-center">
        <p className="text-primary text-sm">
          Si <span className="font-medium">{getValues('email')}</span> tiene una cuenta, le hemos
          enviado un enlace para elegir una contraseña nueva.
        </p>
        <p className="text-secondary text-xs">
          Revisa también la carpeta de spam. El enlace caduca en una hora.
        </p>
        <Link href="/login" className="text-accent inline-block text-sm">
          Volver al inicio de sesión
        </Link>
      </div>
    );
  }

  return (
    <form onSubmit={handleSubmit(onSubmit)} noValidate className="space-y-3">
      <p className="text-secondary mb-4 text-sm">
        Escribe tu email y te enviaremos un enlace para elegir una contraseña nueva.
      </p>
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
      <button type="submit" disabled={isSubmitting} className={submitBtn}>
        {isSubmitting ? 'Enviando…' : 'Enviar enlace'}
      </button>
      <p className="text-secondary pt-1 text-center text-xs">
        <Link href="/login" className="text-accent">
          Volver al inicio de sesión
        </Link>
      </p>
    </form>
  );
}
