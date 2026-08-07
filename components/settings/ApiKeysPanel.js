'use client';

import { useState } from 'react';
import { toast } from 'sonner';
import { Copy, Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import {
  createApiKeyAction,
  listApiKeysAction,
  revokeApiKeyAction,
} from '@/app/(workspace)/settings/actions';

export function ApiKeysPanel({ initialKeys }) {
  const [keys, setKeys] = useState(initialKeys);
  const [name, setName] = useState('');
  const [token, setToken] = useState(null);

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

  async function revoke(id) {
    const r = await revokeApiKeyAction({ id });
    if (r.ok) refresh();
    else toast.error(r.message);
  }

  return (
    <div className="space-y-4">
      <form onSubmit={create} className="flex gap-2">
        <Input
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="Nombre de la API key"
        />
        <Button size="sm" type="submit">
          Crear
        </Button>
      </form>

      {token && (
        <div className="border-accent bg-accent-subtle rounded-md border p-3">
          <p className="text-primary mb-1 text-xs font-medium">
            Copia el token ahora — no volverá a mostrarse:
          </p>
          <div className="flex items-center gap-2">
            <code className="text-primary flex-1 truncate font-mono text-xs">{token}</code>
            <button
              type="button"
              onClick={() => {
                navigator.clipboard?.writeText(token);
                toast.success('Token copiado');
              }}
              className="text-accent flex items-center gap-1 text-xs font-medium"
            >
              <Copy size={13} /> Copiar
            </button>
          </div>
        </div>
      )}

      <ul className="border-border bg-surface divide-border divide-y rounded-lg border">
        {keys.length === 0 && <li className="text-tertiary px-4 py-3 text-sm">Sin API keys</li>}
        {keys.map((k) => (
          <li key={k.id} className="flex items-center gap-3 px-4 py-2.5">
            <div className="min-w-0 flex-1">
              <p className="text-primary truncate text-sm font-medium">
                {k.name}
                {k.revokedAt && <span className="text-danger ml-2 text-xs">revocada</span>}
              </p>
              <p className="text-tertiary font-mono text-xs">
                {k.prefix}… · {k.scopes.join(', ')}
              </p>
            </div>
            {!k.revokedAt && (
              <button
                type="button"
                onClick={() => revoke(k.id)}
                className="text-tertiary hover:text-danger"
                aria-label="Revocar"
              >
                <Trash2 size={14} />
              </button>
            )}
          </li>
        ))}
      </ul>
    </div>
  );
}

export default ApiKeysPanel;
