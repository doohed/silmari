'use client';

import { useRef, useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { toast } from 'sonner';
import { slugify } from '@/lib/utils/slugify';
import { workspaceStepSchema } from '@/lib/validation/onboarding';
import { saveWorkspaceAction } from '@/app/onboarding/actions';
import { StepFrame } from './StepFrame';
import { ImagePicker } from './ImagePicker';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Label } from '@/components/ui/Label';
import { FormError } from '@/components/ui/FormError';
import { applyFieldErrors } from '@/lib/forms/apply-field-errors';

/** Paso 1 del onboarding: nombre, subdominio y logo del workspace. */
export function WorkspaceStep({ initial, appDomain }) {
  const [logoUrl, setLogoUrl] = useState(initial.logoUrl ?? null);
  const subdomainEdited = useRef(false);
  const {
    register,
    handleSubmit,
    setError,
    setValue,
    watch,
    formState: { errors, isSubmitting },
  } = useForm({
    resolver: zodResolver(workspaceStepSchema),
    defaultValues: {
      name: initial.name === 'Mi espacio de trabajo' ? '' : initial.name,
      subdomain: '',
    },
  });
  const name = watch('name');

  const nameReg = register('name');
  const subdomainReg = register('subdomain');

  async function onSubmit(values) {
    const result = await saveWorkspaceAction({ ...values, logoUrl: logoUrl ?? '' });
    if (result?.ok === false) {
      if (result.fieldErrors) applyFieldErrors(setError, result.fieldErrors);
      else toast.error(result.message);
    }
  }

  return (
    <StepFrame title="Crea tu espacio de trabajo" subtitle="Haz avanzar el trabajo de tu equipo">
      <form onSubmit={handleSubmit(onSubmit)} noValidate className="space-y-6">
        <ImagePicker
          value={logoUrl}
          onChange={setLogoUrl}
          name={name || 'W'}
          shape="xl"
          label="Subir logo"
        />

        <div>
          <Label htmlFor="name">Nombre</Label>
          <Input
            id="name"
            autoFocus
            placeholder="Mi empresa"
            {...nameReg}
            onChange={(e) => {
              nameReg.onChange(e);
              if (!subdomainEdited.current) {
                setValue('subdomain', slugify(e.target.value), { shouldValidate: false });
              }
            }}
          />
          <FormError message={errors.name?.message} />
        </div>

        <div>
          <Label htmlFor="subdomain">Subdominio</Label>
          <div className="focus-within:border-accent border-border bg-surface flex h-10 items-center rounded-lg border pr-3 transition-[border-color]">
            <input
              id="subdomain"
              autoComplete="off"
              spellCheck={false}
              placeholder="mi-empresa"
              className="text-primary placeholder:text-tertiary h-full min-w-0 flex-1 rounded-lg bg-transparent px-3.5 outline-none"
              {...subdomainReg}
              onChange={(e) => {
                subdomainEdited.current = true;
                subdomainReg.onChange(e);
              }}
            />
            <span className="text-tertiary shrink-0 text-sm">.{appDomain}</span>
          </div>
          <FormError message={errors.subdomain?.message} />
        </div>

        <Button type="submit" disabled={isSubmitting} className="w-full">
          {isSubmitting ? 'Creando…' : 'Crear espacio de trabajo'}
        </Button>
      </form>
    </StepFrame>
  );
}

export default WorkspaceStep;
