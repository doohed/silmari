'use client';

import { useState } from 'react';
import { toast } from 'sonner';
import { Copy, Plus, Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { SettingsGroup, SettingsRow, SettingsEmpty } from '@/components/ui/SettingsGroup';
import { useConfirm } from '@/components/ui/ConfirmDialog';
import {
  createApiKeyAction,
  listApiKeysAction,
  revokeApiKeyAction,
} from '@/app/(workspace)/settings/actions';

/**
 * API keys en listas agrupadas, como el resto de Ajustes.
 *
 * El alta es un grupo propio arriba y no un formulario suelto flotando sobre la
 * lista: en una lista agrupada, un control sin caja parece que se ha caído de
 * algún sitio.
 *
 * El token recién creado aparece en su propio grupo destacado y **solo esa vez**
 * — no se guarda en claro—, así que tiene que verse antes que la lista, no
 * después.
 */
export function ApiKeysPanel({ initialKeys }) {
  const [keys, setKeys] = useState(initialKeys);
  const [name, setName] = useState('');
  const [token, setToken] = useState(null);
  const confirm = useConfirm();

  async function refresh() {
    const r = await listApiKeysAction();
    if (r.ok) setKeys(r.data);
  }

  async function create(e) {
    e.preventDefault();
    if (!name.trim()) return;
    const r = await createApiKeyAction({ name });
    if (!r.ok) return toast.error(r.message);
    setToken(r.data.token);
    setName('');
    refresh();
  }

  async function revoke(key) {
    const ok = await confirm({
      title: `¿Revocar "${key.name}"?`,
      message: 'Quien la esté usando dejará de tener acceso a la API de inmediato.',
      confirmLabel: 'Revocar',
      danger: true,
    });
    if (!ok) return;
    const r = await revokeApiKeyAction({ id: key.id });
    if (r.ok) refresh();
    else toast.error(r.message);
  }

  return (
    <div>
      <SettingsGroup footnote="Autentican la API pública en /api/v1. Consulta docs/api.md para los detalles.">
        <SettingsRow label="Nueva API key">
          <form onSubmit={create} className="flex gap-2">
            <Input
              aria-label="Nombre de la API key"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Nombre"
              className="w-56"
            />
            <Button size="md" type="submit" disabled={!name.trim()}>
              <Plus size={14} /> Crear
            </Button>
          </form>
        </SettingsRow>
      </SettingsGroup>

      {token && (
        <SettingsGroup
          title="Token nuevo"
          footnote="Cópialo ahora: se guarda solo su hash, así que no se puede volver a mostrar."
        >
          <SettingsRow stacked label="Token">
            <div className="border-accent bg-accent-subtle flex items-center gap-2 rounded-lg border px-3 py-2">
              <code className="text-primary min-w-0 flex-1 truncate font-mono text-xs">
                {token}
              </code>
              <Button
                type="button"
                variant="secondary"
                size="sm"
                onClick={() => {
                  navigator.clipboard?.writeText(token);
                  toast.success('Token copiado');
                }}
              >
                <Copy size={13} /> Copiar
              </Button>
            </div>
          </SettingsRow>
        </SettingsGroup>
      )}

      <SettingsGroup title="Claves">
        {keys.length === 0 && <SettingsEmpty>Todavía no has creado ninguna</SettingsEmpty>}
        {keys.map((k) => (
          <SettingsRow
            key={k.id}
            label={k.name}
            hint={`${k.prefix}… · ${k.scopes.join(', ')}`}
            className={k.revokedAt ? 'opacity-60' : undefined}
          >
            {k.revokedAt ? (
              <span className="bg-chip-gray text-chip-gray-fg rounded-full px-2 py-0.5 text-xs">
                Revocada
              </span>
            ) : (
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={() => revoke(k)}
                aria-label={`Revocar ${k.name}`}
                className="hover:text-danger"
              >
                <Trash2 size={14} />
              </Button>
            )}
          </SettingsRow>
        ))}
      </SettingsGroup>
    </div>
  );
}

export default ApiKeysPanel;
