'use client';

import { useState } from 'react';
import { toast } from 'sonner';
import { Trash2, RefreshCw, Plus } from 'lucide-react';
import { format } from 'date-fns';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { SettingsGroup, SettingsRow, SettingsEmpty } from '@/components/ui/SettingsGroup';
import { useConfirm } from '@/components/ui/ConfirmDialog';
import {
  createWebhookAction,
  listWebhooksAction,
  deleteWebhookAction,
  retryDeliveryAction,
} from '@/app/(workspace)/settings/actions';

const EVENTS = ['created', 'updated', 'deleted'];

/**
 * Webhooks en listas agrupadas.
 *
 * **Cada webhook es su propio grupo**, con la URL de título. Es lo que hace
 * macOS con las cosas conectadas (una cuenta, un dispositivo): un grupo por
 * cada una, con sus ajustes dentro. Además resuelve el problema que tenía la
 * versión anterior, donde el registro de entregas colgaba de la tarjeta y no
 * quedaba claro a qué webhook pertenecía cuando había varios seguidos.
 */
export function WebhooksPanel({ initialWebhooks, objects }) {
  const [hooks, setHooks] = useState(initialWebhooks);
  const [targetUrl, setTargetUrl] = useState('');
  const [ops, setOps] = useState(new Set());
  const confirm = useConfirm();

  const allOps = objects.flatMap((o) => EVENTS.map((e) => `${o.nameSingular}.${e}`));

  async function refresh() {
    const r = await listWebhooksAction();
    if (r.ok) setHooks(r.data);
  }

  function toggleOp(op) {
    setOps((prev) => {
      const n = new Set(prev);
      if (n.has(op)) n.delete(op);
      else n.add(op);
      return n;
    });
  }

  async function create(e) {
    e.preventDefault();
    const r = await createWebhookAction({ targetUrl, operations: [...ops] });
    if (!r.ok) return toast.error(r.message);
    setTargetUrl('');
    setOps(new Set());
    refresh();
    toast.success('Webhook creado');
  }

  async function remove(hook) {
    const ok = await confirm({
      title: '¿Eliminar este webhook?',
      message: `Se dejará de notificar a ${hook.targetUrl}.`,
      confirmLabel: 'Eliminar',
      danger: true,
    });
    if (!ok) return;
    const r = await deleteWebhookAction({ id: hook.id });
    if (r.ok) refresh();
    else toast.error(r.message);
  }

  async function retry(webhookId, deliveryId) {
    const r = await retryDeliveryAction({ webhookId, deliveryId });
    if (r.ok) {
      setHooks((prev) => prev.map((h) => (h.id === webhookId ? r.data : h)));
      toast.success('Reintentado');
    } else toast.error(r.message);
  }

  return (
    <div>
      <SettingsGroup footnote="Cada entrega va firmada con HMAC en la cabecera x-silmari-signature. El destino tiene que ser una URL pública: no se admiten direcciones de red interna.">
        <SettingsRow label="URL de destino">
          <Input
            aria-label="URL de destino"
            value={targetUrl}
            onChange={(e) => setTargetUrl(e.target.value)}
            placeholder="https://ejemplo.com/webhook"
            className="w-72"
          />
        </SettingsRow>
        <SettingsRow stacked label="Eventos que lo disparan">
          <EventPicker options={allOps} selected={ops} onToggle={toggleOp} />
        </SettingsRow>
        <SettingsRow label="Crear">
          <Button size="md" onClick={create} disabled={!targetUrl || ops.size === 0}>
            <Plus size={14} /> Añadir webhook
          </Button>
        </SettingsRow>
      </SettingsGroup>

      {hooks.length === 0 && (
        <SettingsGroup title="Webhooks">
          <SettingsEmpty>Todavía no has creado ninguno</SettingsEmpty>
        </SettingsGroup>
      )}

      {hooks.map((h) => (
        <SettingsGroup key={h.id} title={h.targetUrl}>
          <SettingsRow stacked label="Eventos">
            <div className="flex flex-wrap gap-1.5">
              {h.operations.map((op) => (
                <span
                  key={op}
                  className="border-border text-secondary rounded-md border px-2 py-0.5 font-mono text-xs"
                >
                  {op}
                </span>
              ))}
            </div>
          </SettingsRow>

          {h.deliveryLog.length > 0 && (
            <SettingsRow stacked label="Últimas entregas">
              <ul className="space-y-1">
                {h.deliveryLog.slice(0, 5).map((d) => (
                  <li key={d.id} className="flex items-center gap-2 text-xs">
                    <span
                      className={`size-2 shrink-0 rounded-full ${d.ok ? 'bg-success' : 'bg-danger'}`}
                      aria-hidden
                    />
                    <span className="text-secondary font-mono">{d.operation}</span>
                    <span className="text-tertiary">{d.ok ? d.statusCode : 'error'}</span>
                    <span className="text-tertiary ml-auto tabular-nums">
                      {format(new Date(d.at), 'HH:mm:ss')}
                    </span>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => retry(h.id, d.id)}
                      aria-label={`Reintentar ${d.operation}`}
                    >
                      <RefreshCw size={12} />
                    </Button>
                  </li>
                ))}
              </ul>
            </SettingsRow>
          )}

          <SettingsRow label="Eliminar webhook" hint="Deja de notificar de inmediato">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => remove(h)}
              aria-label={`Eliminar ${h.targetUrl}`}
              className="hover:text-danger"
            >
              <Trash2 size={14} />
            </Button>
          </SettingsRow>
        </SettingsGroup>
      ))}
    </div>
  );
}

/** Selector múltiple de eventos: fichas que se encienden al pulsarlas. */
function EventPicker({ options, selected, onToggle }) {
  return (
    <div className="flex flex-wrap gap-1.5">
      {options.map((op) => (
        <button
          key={op}
          type="button"
          onClick={() => onToggle(op)}
          aria-pressed={selected.has(op)}
          className={`press rounded-md border px-2 py-0.5 font-mono text-xs ${
            selected.has(op)
              ? 'border-accent bg-accent-subtle text-primary'
              : 'border-border text-secondary hover:bg-sunken'
          }`}
        >
          {op}
        </button>
      ))}
    </div>
  );
}

export default WebhooksPanel;
