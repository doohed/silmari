'use client';

import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { useState } from 'react';
import { toast } from 'sonner';
import { inviteSchema } from '@/lib/validation/auth';
import { inviteMemberAction } from './actions';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { FormError } from '@/components/ui/FormError';
import { applyFieldErrors } from '@/lib/forms/apply-field-errors';

export function InviteForm() {
  const [link, setLink] = useState(null);
  const {
    register,
    handleSubmit,
    reset,
    setError,
    formState: { errors, isSubmitting },
  } = useForm({
    resolver: zodResolver(inviteSchema),
    defaultValues: { email: '', role: 'MEMBER' },
  });

  async function onSubmit(values) {
    const result = await inviteMemberAction(values);
    if (result?.ok) {
      setLink(result.link);
      toast.success('Invitación creada');
      reset();
    } else if (result?.fieldErrors) {
      applyFieldErrors(setError, result.fieldErrors);
    } else {
      toast.error(result?.message ?? 'No se pudo invitar');
    }
  }

  return (
    <div className="space-y-3">
      <form onSubmit={handleSubmit(onSubmit)} noValidate className="flex items-start gap-2">
        <div className="flex-1">
          <Input type="email" placeholder="email@empresa.com" {...register('email')} />
          <FormError message={errors.email?.message} />
        </div>
        <select
          {...register('role')}
          className="border-border bg-surface text-primary h-9 rounded-md border px-2"
          aria-label="Rol"
        >
          <option value="MEMBER">Miembro</option>
          <option value="ADMIN">Admin</option>
        </select>
        <Button type="submit" disabled={isSubmitting}>
          {isSubmitting ? 'Invitando…' : 'Invitar'}
        </Button>
      </form>

      {link && (
        <div className="border-border bg-bg rounded-md border p-3">
          <p className="text-tertiary mb-1 text-xs">
            En desarrollo no se envían emails. Comparte este enlace de invitación:
          </p>
          <div className="flex items-center gap-2">
            <code className="text-primary flex-1 truncate font-mono text-xs">{link}</code>
            <button
              type="button"
              onClick={() => {
                navigator.clipboard?.writeText(link);
                toast.success('Enlace copiado');
              }}
              className="text-accent text-xs font-medium"
            >
              Copiar
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

export default InviteForm;
