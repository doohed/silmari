'use client';

import { useState } from 'react';
import { toast } from 'sonner';
import { Trash2, RefreshCw } from 'lucide-react';
import { format } from 'date-fns';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Label } from '@/components/ui/Label';
import {
  createWebhookAction,
  listWebhooksAction,
  deleteWebhookAction,
  retryDeliveryAction,
} from '@/app/(workspace)/settings/actions';

const EVENTS = ['created', 'updated', 'deleted'];

export function WebhooksPanel({ initialWebhooks, objects }) {
  const [hooks, setHooks] = useState(initialWebhooks);
  const [targetUrl, setTargetUrl] = useState('');
  const [ops, setOps] = useState(new Set());

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

  async function remove(id) {
    const r = await deleteWebhookAction({ id });
    if (r.ok) refresh();
  }

  async function retry(webhookId, deliveryId) {
    const r = await retryDeliveryAction({ webhookId, deliveryId });
    if (r.ok) {
      setHooks((prev) => prev.map((h) => (h.id === webhookId ? r.data : h)));
      toast.success('Reintentado');
    } else toast.error(r.message);
  }

  return (
    <div className="space-y-4">
      <form onSubmit={create} className="border-border bg-bg space-y-3 rounded-lg border p-4">
        <div>
          <Label htmlFor="url">URL de destino</Label>
          <Input
            id="url"
            value={targetUrl}
            onChange={(e) => setTargetUrl(e.target.value)}
            placeholder="https://ejemplo.com/webhook"
          />
        </div>
        <div>
          <Label>Eventos</Label>
          <div className="flex flex-wrap gap-1.5">
            {allOps.map((op) => (
              <button
                key={op}
                type="button"
                onClick={() => toggleOp(op)}
                className={`rounded-md border px-2 py-0.5 font-mono text-xs ${ops.has(op) ? 'border-accent bg-accent-subtle text-primary' : 'border-border text-secondary'}`}
              >
                {op}
              </button>
            ))}
          </div>
        </div>
        <Button size="sm" type="submit" disabled={!targetUrl || ops.size === 0}>
          Crear webhook
        </Button>
      </form>

      <ul className="space-y-3">
        {hooks.length === 0 && <li className="text-tertiary text-sm">Sin webhooks</li>}
        {hooks.map((h) => (
          <li key={h.id} className="border-border bg-surface rounded-lg border p-3">
            <div className="mb-2 flex items-start justify-between gap-2">
              <div className="min-w-0">
                <p className="text-primary truncate text-sm font-medium">{h.targetUrl}</p>
                <p className="text-tertiary truncate font-mono text-xs">
                  {h.operations.join(', ')}
                </p>
              </div>
              <button
                type="button"
                onClick={() => remove(h.id)}
                className="text-tertiary hover:text-danger shrink-0"
                aria-label="Borrar webhook"
              >
                <Trash2 size={14} />
              </button>
            </div>

            {h.deliveryLog.length > 0 && (
              <ul className="border-border mt-2 space-y-1 border-t pt-2">
                {h.deliveryLog.slice(0, 5).map((d) => (
                  <li key={d.id} className="flex items-center gap-2 text-xs">
                    <span
                      className={`size-2 shrink-0 rounded-full ${d.ok ? 'bg-success' : 'bg-danger'}`}
                    />
                    <span className="text-secondary font-mono">{d.operation}</span>
                    <span className="text-tertiary">{d.ok ? d.statusCode : 'error'}</span>
                    <span className="text-tertiary ml-auto">
                      {format(new Date(d.at), 'HH:mm:ss')}
                    </span>
                    <button
                      type="button"
                      onClick={() => retry(h.id, d.id)}
                      className="text-accent"
                      aria-label="Reintentar"
                    >
                      <RefreshCw size={12} />
                    </button>
                  </li>
                ))}
              </ul>
            )}
          </li>
        ))}
      </ul>
    </div>
  );
}

export default WebhooksPanel;
