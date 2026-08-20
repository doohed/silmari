'use client';

import { useState } from 'react';
import { toast } from 'sonner';
import { Input } from '@/components/ui/Input';
import { Select } from '@/components/ui/Select';
import { SettingsGroup, SettingsRow } from '@/components/ui/SettingsGroup';
import { ImagePicker } from '@/components/onboarding/ImagePicker';
import { CURRENCIES, TIMEZONES } from '@/lib/config/locale-options';
import { updateWorkspaceAction } from '@/app/(workspace)/settings/actions';

/**
 * Ajustes del espacio de trabajo, en listas agrupadas como en Perfil. Cada
 * campo se guarda al momento: no hay botón de guardar, igual que en Ajustes del
 * Sistema.
 */
export function WorkspaceForm({ workspace }) {
  const [name, setName] = useState(workspace.name ?? '');
  const [logoUrl, setLogoUrl] = useState(workspace.logoUrl ?? null);
  const [currency, setCurrency] = useState(workspace.settings?.currency ?? 'EUR');
  const [timezone, setTimezone] = useState(workspace.settings?.timezone ?? 'Europe/Madrid');

  async function save(patch, msg = 'Guardado') {
    const r = await updateWorkspaceAction(patch);
    if (r.ok) toast.success(msg);
    else toast.error(r.message);
    return r.ok;
  }

  async function saveLogo(next) {
    setLogoUrl(next);
    await save({ logoUrl: next ?? '' }, 'Logo actualizado');
  }
  async function saveCurrency(v) {
    setCurrency(v);
    await save({ settings: { currency: v } }, 'Moneda actualizada');
  }
  async function saveTimezone(v) {
    setTimezone(v);
    await save({ settings: { timezone: v } }, 'Zona horaria actualizada');
  }

  return (
    <>
      <SettingsGroup>
        <SettingsRow label="Logo">
          <ImagePicker
            value={logoUrl}
            onChange={saveLogo}
            name={name || 'W'}
            shape="xl"
            label="Subir"
          />
        </SettingsRow>
        <SettingsRow label="Nombre">
          <Input
            aria-label="Nombre del espacio de trabajo"
            value={name}
            onChange={(e) => setName(e.target.value)}
            onBlur={() => name.trim() && save({ name }, 'Nombre actualizado')}
            className="w-56"
          />
        </SettingsRow>
      </SettingsGroup>

      <SettingsGroup title="Formato">
        <SettingsRow label="Moneda" hint="Se usa para mostrar importes y las sumas del kanban">
          <Select
            value={currency}
            onChange={saveCurrency}
            options={CURRENCIES}
            placeholder="Elige una moneda"
            className="w-56"
          />
        </SettingsRow>
        <SettingsRow label="Zona horaria">
          <Select
            value={timezone}
            onChange={saveTimezone}
            options={TIMEZONES}
            searchable
            placeholder="Elige una zona horaria"
            className="w-56"
          />
        </SettingsRow>
      </SettingsGroup>
    </>
  );
}

export default WorkspaceForm;
