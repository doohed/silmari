'use client';

import { useState } from 'react';
import { Pencil, Shield, ChevronRight } from 'lucide-react';
import { toast } from 'sonner';
import { Input } from '@/components/ui/Input';
import { Label } from '@/components/ui/Label';
import { ImagePicker } from '@/components/onboarding/ImagePicker';
import { PasswordSection } from './PasswordSection';
import { LanguageSection } from './LanguageSection';
import { DeleteAccountSection } from './DeleteAccountSection';
import { updateProfileAction } from '@/app/(workspace)/settings/actions';

/** Bloque de ajuste: título, descripción y contenido, con separador. */
function Section({ title, description, children, danger }) {
  return (
    <section className="border-border border-b py-8 first:pt-0 last:border-b-0">
      <h2 className={`text-sm font-semibold ${danger ? 'text-danger' : 'text-primary'}`}>{title}</h2>
      {description && <p className="text-secondary mt-1 text-sm">{description}</p>}
      <div className="mt-4">{children}</div>
    </section>
  );
}

/**
 * Ajustes de perfil: foto, nombre, email, 2FA, contraseña y zona de peligro.
 * @param {{ account: { firstName:string, lastName:string, email:string, avatarUrl:string|null, hasPassword:boolean } }} props
 */
export function ProfileForm({ account }) {
  const [firstName, setFirstName] = useState(account.firstName ?? '');
  const [lastName, setLastName] = useState(account.lastName ?? '');
  const [avatarUrl, setAvatarUrl] = useState(account.avatarUrl ?? null);
  const fullName = `${firstName} ${lastName}`.trim();

  async function saveAvatar(next) {
    setAvatarUrl(next);
    const r = await updateProfileAction({ avatarUrl: next ?? '' });
    if (!r.ok) toast.error(r.message);
  }

  async function saveName() {
    const r = await updateProfileAction({ firstName, lastName });
    if (!r.ok) toast.error(r.message);
  }

  return (
    <div>
      <Section title="Foto" description="Aceptamos PNG, JPEG y GIF cuadrados">
        <ImagePicker value={avatarUrl} onChange={saveAvatar} name={fullName || '·'} shape="xl" label="Subir" />
      </Section>

      <Section title="Nombre" description="Tu nombre tal y como se mostrará">
        <div className="grid max-w-xl grid-cols-2 gap-3">
          <div>
            <Label htmlFor="firstName">Nombre</Label>
            <Input
              id="firstName"
              value={firstName}
              onChange={(e) => setFirstName(e.target.value)}
              onBlur={saveName}
            />
          </div>
          <div>
            <Label htmlFor="lastName">Apellidos</Label>
            <Input
              id="lastName"
              value={lastName}
              onChange={(e) => setLastName(e.target.value)}
              onBlur={saveName}
            />
          </div>
        </div>
      </Section>

      <Section title="Email" description="El email asociado a tu cuenta">
        <div className="flex max-w-xl items-center gap-2">
          <Input value={account.email} disabled className="flex-1" />
          <button
            type="button"
            disabled
            title="El email no se puede cambiar por ahora"
            className="border-border text-tertiary flex size-10 shrink-0 cursor-not-allowed items-center justify-center rounded-lg border opacity-60"
            aria-label="Editar email"
          >
            <Pencil size={15} />
          </button>
        </div>
      </Section>

      <Section title="Idioma" description="Idioma de la interfaz">
        <LanguageSection />
      </Section>

      <Section
        title="Autenticación en dos pasos"
        description="Añade seguridad pidiendo un código junto a tu contraseña"
      >
        <div
          className="border-border bg-surface flex max-w-xl cursor-not-allowed items-center justify-between rounded-xl border px-4 py-3 opacity-70"
          title="Próximamente"
        >
          <span className="text-primary flex items-center gap-3 text-sm">
            <Shield size={18} className="text-tertiary" /> App de autenticación
          </span>
          <span className="text-tertiary flex items-center gap-2 text-xs">
            <span className="bg-chip-gray text-chip-gray-fg rounded-full px-2 py-0.5">
              Desactivado
            </span>
            <ChevronRight size={15} />
          </span>
        </div>
      </Section>

      <Section
        title={account.hasPassword ? 'Contraseña' : 'Establecer contraseña'}
        description={
          account.hasPassword
            ? 'Cambia la contraseña de tu cuenta'
            : 'Crea una contraseña para acceder también con email'
        }
      >
        <PasswordSection hasPassword={account.hasPassword} />
      </Section>

      <Section title="Zona de peligro" description="Elimina tu cuenta y su acceso" danger>
        <DeleteAccountSection />
      </Section>
    </div>
  );
}

export default ProfileForm;
