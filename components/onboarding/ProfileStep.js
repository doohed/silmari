'use client';

import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { toast } from 'sonner';
import { profileStepSchema } from '@/lib/validation/onboarding';
import { saveProfileAction } from '@/app/onboarding/actions';
import { StepFrame } from './StepFrame';
import { ImagePicker } from './ImagePicker';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Label } from '@/components/ui/Label';
import { FormError } from '@/components/ui/FormError';
import { applyFieldErrors } from '@/lib/forms/apply-field-errors';

/** Paso 2 del onboarding: nombre, puesto y foto del usuario. */
export function ProfileStep({ initial }) {
  const [avatarUrl, setAvatarUrl] = useState(initial.avatarUrl ?? null);
  const {
    register,
    handleSubmit,
    setError,
    watch,
    formState: { errors, isSubmitting },
  } = useForm({
    resolver: zodResolver(profileStepSchema),
    defaultValues: {
      firstName: initial.firstName ?? '',
      lastName: initial.lastName ?? '',
      jobTitle: initial.jobTitle ?? '',
    },
  });
  const fullName = `${watch('firstName') ?? ''} ${watch('lastName') ?? ''}`.trim();

  async function onSubmit(values) {
    const result = await saveProfileAction({ ...values, avatarUrl: avatarUrl ?? '' });
    if (result?.ok === false) {
      if (result.fieldErrors) applyFieldErrors(setError, result.fieldErrors);
      else toast.error(result.message);
    }
  }

  return (
    <StepFrame title="Cuéntanos sobre ti" subtitle="Así te reconocerá tu equipo">
      <form onSubmit={handleSubmit(onSubmit)} noValidate className="space-y-6">
        <ImagePicker
          value={avatarUrl}
          onChange={setAvatarUrl}
          name={fullName || '·'}
          label="Subir foto"
        />

        <div className="grid grid-cols-2 gap-3">
          <div>
            <Label htmlFor="firstName">Nombre</Label>
            <Input id="firstName" autoFocus autoComplete="given-name" {...register('firstName')} />
            <FormError message={errors.firstName?.message} />
          </div>
          <div>
            <Label htmlFor="lastName">Apellidos</Label>
            <Input id="lastName" autoComplete="family-name" {...register('lastName')} />
            <FormError message={errors.lastName?.message} />
          </div>
        </div>

        <div>
          <Label htmlFor="jobTitle">Puesto en la empresa</Label>
          <Input id="jobTitle" placeholder="p. ej. Directora comercial" {...register('jobTitle')} />
          <FormError message={errors.jobTitle?.message} />
        </div>

        <Button type="submit" disabled={isSubmitting} className="w-full">
          {isSubmitting ? 'Guardando…' : 'Continuar'}
        </Button>
      </form>
    </StepFrame>
  );
}

export default ProfileStep;
