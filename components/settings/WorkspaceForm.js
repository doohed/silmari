'use client';

import { useState } from 'react';
import { toast } from 'sonner';
import { Input } from '@/components/ui/Input';
import { Label } from '@/components/ui/Label';
import { Select } from '@/components/ui/Select';
import { ImagePicker } from '@/components/onboarding/ImagePicker';
import { CURRENCIES, TIMEZONES } from '@/lib/config/locale-options';
import { updateWorkspaceAction } from '@/app/(workspace)/settings/actions';

/** Ajustes del espacio de trabajo. Cada campo se guarda al momento. */
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
    <div className="max-w-md space-y-6">
      <div>
        <Label>Logo</Label>
        <ImagePicker
          value={logoUrl}
          onChange={saveLogo}
          name={name || 'W'}
          shape="xl"
          label="Subir logo"
        />
      </div>

      <div>
        <Label htmlFor="name">Nombre</Label>
        <Input
          id="name"
          value={name}
          onChange={(e) => setName(e.target.value)}
          onBlur={() => name.trim() && save({ name }, 'Nombre actualizado')}
        />
      </div>

      <div>
        <Label htmlFor="currency">Moneda</Label>
        <Select
          value={currency}
          onChange={saveCurrency}
          options={CURRENCIES}
          placeholder="Elige una moneda"
        />
        <p className="text-tertiary mt-1 text-xs">
          Se usa para mostrar importes y las sumas del kanban.
        </p>
      </div>

      <div>
        <Label htmlFor="timezone">Zona horaria</Label>
        <Select
          value={timezone}
          onChange={saveTimezone}
          options={TIMEZONES}
          searchable
          placeholder="Elige una zona horaria"
        />
      </div>
    </div>
  );
}

export default WorkspaceForm;
