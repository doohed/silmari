'use client';

import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { useState } from 'react';
import { toast } from 'sonner';
import { acceptInviteSchema } from '@/lib/validation/auth';
import { acceptInviteAction } from '../../actions';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Label } from '@/components/ui/Label';
import { FormError } from '@/components/ui/FormError';
import { applyFieldErrors } from '@/lib/forms/apply-field-errors';

/**
 * @param {{ token: string, invite: { isExistingUser: boolean, workspaceName: string } }} props
 */
export function AcceptInviteForm({ token, invite }) {
  // Usuario existente: basta un botón para unirse (el token del email autoriza).
  if (invite.isExistingUser) {
    return <JoinButton token={token} workspaceName={invite.workspaceName} />;
  }
  return <NewUserForm token={token} />;
}

function JoinButton({ token, workspaceName }) {
  const [pending, setPending] = useState(false);
  async function join() {
    setPending(true);
    const result = await acceptInviteAction({ token, isExistingUser: true });
    if (result?.ok === false) {
      toast.error(result.message);
      setPending(false);
    }
  }
  return (
    <Button onClick={join} disabled={pending} className="w-full">
      {pending ? 'Uniéndote…' : `Unirte a ${workspaceName}`}
    </Button>
  );
}

function NewUserForm({ token }) {
  const {
    register,
    handleSubmit,
    setError,
    formState: { errors, isSubmitting },
  } = useForm({
    resolver: zodResolver(acceptInviteSchema),
    defaultValues: { firstName: '', lastName: '', password: '' },
  });

  async function onSubmit(values) {
    const result = await acceptInviteAction({ token, ...values });
    if (result?.ok === false) {
      if (result.fieldErrors) applyFieldErrors(setError, result.fieldErrors);
      else toast.error(result.message);
    }
  }

  return (
    <form onSubmit={handleSubmit(onSubmit)} noValidate className="space-y-4">
      <div className="grid grid-cols-2 gap-3">
        <div>
          <Label htmlFor="firstName">Nombre</Label>
          <Input id="firstName" autoComplete="given-name" {...register('firstName')} />
          <FormError message={errors.firstName?.message} />
        </div>
        <div>
          <Label htmlFor="lastName">Apellidos</Label>
          <Input id="lastName" autoComplete="family-name" {...register('lastName')} />
          <FormError message={errors.lastName?.message} />
        </div>
      </div>
      <div>
        <Label htmlFor="password">Contraseña</Label>
        <Input
          id="password"
          type="password"
          autoComplete="new-password"
          {...register('password')}
        />
        <FormError message={errors.password?.message} />
      </div>
      <Button type="submit" disabled={isSubmitting} className="w-full">
        {isSubmitting ? 'Aceptando…' : 'Aceptar invitación'}
      </Button>
    </form>
  );
}

export default AcceptInviteForm;
