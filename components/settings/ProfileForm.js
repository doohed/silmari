'use client';

import { useState } from 'react';
import { toast } from 'sonner';
import { Input } from '@/components/ui/Input';
import { SettingsGroup, SettingsRow } from '@/components/ui/SettingsGroup';
import { ImagePicker } from '@/components/onboarding/ImagePicker';
import { PasswordSection } from './PasswordSection';
import { LanguageSection } from './LanguageSection';
import { ThemeSection } from './ThemeSection';
import { DeleteAccountSection } from './DeleteAccountSection';
import { updateProfileAction } from '@/app/(workspace)/settings/actions';

/**
 * Ajustes de perfil en listas agrupadas.
 *
 * Una fila = una etiqueta + su control, y nada más: el título del grupo, la
 * etiqueta de la fila y una descripción decían casi siempre lo mismo tres
 * veces. Solo queda `hint` donde aporta algo que el control no enseña (que el
 * email no se puede cambiar, que borrar la cuenta no tiene vuelta atrás).
 *
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
      {/* Sin título: el h1 de la página ya dice "Perfil". */}
      <SettingsGroup>
        <SettingsRow label="Foto">
          <ImagePicker
            value={avatarUrl}
            onChange={saveAvatar}
            name={fullName || '·'}
            shape="xl"
            label="Subir"
          />
        </SettingsRow>
        <SettingsRow label="Nombre">
          <Input
            aria-label="Nombre"
            value={firstName}
            onChange={(e) => setFirstName(e.target.value)}
            onBlur={saveName}
            className="w-56"
          />
        </SettingsRow>
        <SettingsRow label="Apellidos">
          <Input
            aria-label="Apellidos"
            value={lastName}
            onChange={(e) => setLastName(e.target.value)}
            onBlur={saveName}
            className="w-56"
          />
        </SettingsRow>
        <SettingsRow label="Email" hint="No se puede cambiar por ahora">
          <span className="text-secondary text-[13px]">{account.email}</span>
        </SettingsRow>
      </SettingsGroup>

      <SettingsGroup title="Preferencias">
        <SettingsRow label="Idioma">
          <LanguageSection />
        </SettingsRow>
        <SettingsRow label="Tema">
          <ThemeSection />
        </SettingsRow>
      </SettingsGroup>

      <SettingsGroup title="Seguridad">
        <SettingsRow label="Verificación en dos pasos">
          <span className="bg-chip-gray text-chip-gray-fg rounded-full px-2 py-0.5 text-xs">
            Próximamente
          </span>
        </SettingsRow>
        <SettingsRow stacked label={account.hasPassword ? 'Contraseña' : 'Establecer contraseña'}>
          <PasswordSection hasPassword={account.hasPassword} />
        </SettingsRow>
      </SettingsGroup>

      <SettingsGroup>
        <SettingsRow label="Eliminar cuenta" hint="Es irreversible: pierdes el acceso">
          <DeleteAccountSection />
        </SettingsRow>
      </SettingsGroup>
    </div>
  );
}

export default ProfileForm;
