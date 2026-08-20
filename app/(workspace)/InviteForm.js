'use client';

import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { useState } from 'react';
import { toast } from 'sonner';
import { Copy, Send } from 'lucide-react';
import { inviteSchema } from '@/lib/validation/auth';
import { inviteMemberAction } from './actions';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { FormError } from '@/components/ui/FormError';
import { SettingsGroup, SettingsRow } from '@/components/ui/SettingsGroup';
import { applyFieldErrors } from '@/lib/forms/apply-field-errors';

/**
 * Alta de un miembro, en filas de una lista agrupada.
 *
 * El enlace que devuelve la acción aparece en su propio grupo debajo: sirve de
 * respaldo cuando el correo no llega (o cuando no hay remitente configurado en
 * el entorno), así que tiene que poder copiarse, no solo leerse.
 */
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
    <>
      <SettingsGroup footnote="Quien acepte la invitación entra directamente en este espacio de trabajo.">
        <SettingsRow stacked label="Invitar a alguien">
          <form onSubmit={handleSubmit(onSubmit)} noValidate className="flex items-start gap-2">
            <div className="flex-1">
              <Input
                type="email"
                placeholder="email@empresa.com"
                aria-label="Email"
                {...register('email')}
              />
              <FormError message={errors.email?.message} />
            </div>
            <select
              {...register('role')}
              className="border-border bg-surface text-primary mac-focus h-8 rounded-lg border px-2 text-[13px]"
              aria-label="Rol"
            >
              <option value="MEMBER">Miembro</option>
              <option value="ADMIN">Admin</option>
            </select>
            <Button type="submit" disabled={isSubmitting}>
              <Send size={13} /> {isSubmitting ? 'Invitando…' : 'Invitar'}
            </Button>
          </form>
        </SettingsRow>
      </SettingsGroup>

      {link && (
        <SettingsGroup
          title="Enlace de invitación"
          footnote="Compártelo si el correo no llega. Caduca y solo se puede usar una vez."
        >
          <SettingsRow stacked label="Enlace">
            <div className="border-border bg-sunken flex items-center gap-2 rounded-lg border px-3 py-2">
              <code className="text-primary min-w-0 flex-1 truncate font-mono text-xs">{link}</code>
              <Button
                type="button"
                variant="secondary"
                size="sm"
                onClick={() => {
                  navigator.clipboard?.writeText(link);
                  toast.success('Enlace copiado');
                }}
              >
                <Copy size={13} /> Copiar
              </Button>
            </div>
          </SettingsRow>
        </SettingsGroup>
      )}
    </>
  );
}

export default InviteForm;
