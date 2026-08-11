'use client';

import { useState } from 'react';
import { toast } from 'sonner';
import { Trash2, Pencil, Copy, Check } from 'lucide-react';
import { format } from 'date-fns';
import { Button } from '@/components/ui/Button';
import { useConfirm } from '@/components/ui/ConfirmDialog';
import { LeadIntakeForm } from '@/components/settings/LeadIntakeForm';
import {
  createLeadIntakeAction,
  listLeadIntakesAction,
  updateLeadIntakeAction,
  deleteLeadIntakeAction,
} from '@/app/(workspace)/settings/actions';

/**
 * Configuraciones de entrada de leads: endpoint a pegar en Zapier/Make y una
 * lista de formularios de Meta con su mapeo a objetos del CRM.
 * @param {{ initialIntakes: Array<object>, objects: Array<object>, endpoint: string }} props
 */
export function LeadIntakesPanel({ initialIntakes, objects, endpoint }) {
  const [intakes, setIntakes] = useState(initialIntakes);
  const [editing, setEditing] = useState(null); // null | 'new' | id
  const [copied, setCopied] = useState(false);
  const confirm = useConfirm();

  async function refresh() {
    const r = await listLeadIntakesAction();
    if (r.ok) setIntakes(r.data);
  }

  async function copyEndpoint() {
    await navigator.clipboard.writeText(endpoint);
    setCopied(true);
    setTimeout(() => setCopied(false), 1500);
  }

  async function save(input) {
    const r =
      editing === 'new'
        ? await createLeadIntakeAction(input)
        : await updateLeadIntakeAction({ id: editing, ...input });
    if (!r.ok) {
      toast.error(r.message);
      return false;
    }
    await refresh();
    toast.success(editing === 'new' ? 'Configuración creada' : 'Configuración guardada');
    return true;
  }

  async function toggleActive(intake) {
    const r = await updateLeadIntakeAction({ id: intake.id, isActive: !intake.isActive });
    if (r.ok) setIntakes((prev) => prev.map((i) => (i.id === intake.id ? r.data : i)));
    else toast.error(r.message);
  }

  async function remove(intake) {
    const ok = await confirm({
      title: `Borrar «${intake.name}»`,
      message: 'Los leads de este formulario dejarán de crear registros.',
      confirmLabel: 'Borrar',
      danger: true,
    });
    if (!ok) return;
    const r = await deleteLeadIntakeAction({ id: intake.id });
    if (r.ok) refresh();
    else toast.error(r.message);
  }

  if (objects.length === 0) {
    return (
      <p className="text-tertiary text-sm">
        Crea antes un objeto en Modelo de datos para poder recibir leads.
      </p>
    );
  }

  return (
    <div className="space-y-5">
      <div className="border-border bg-surface rounded-lg border p-4">
        <p className="text-primary mb-1 text-sm font-medium">URL para Zapier o Make</p>
        <p className="text-secondary mb-3 text-xs">
          En el Zap, tras el trigger «New Lead» de Facebook Lead Ads, añade una acción{' '}
          <span className="text-primary">Webhooks → Custom Request</span> con método POST a esta
          URL, cabecera <code className="text-primary">Authorization: Bearer TU_API_KEY</code> y el
          lead como cuerpo JSON. La API key se crea en Ajustes → API keys con permiso{' '}
          <code className="text-primary">records:write</code>.
        </p>
        <div className="border-border bg-bg flex items-center gap-2 rounded-md border px-3 py-2">
          <code className="text-primary flex-1 truncate text-xs">{endpoint}</code>
          <button
            type="button"
            onClick={copyEndpoint}
            className="text-tertiary hover:text-primary shrink-0"
            aria-label="Copiar URL"
          >
            {copied ? <Check size={14} /> : <Copy size={14} />}
          </button>
        </div>
      </div>

      {editing === 'new' ? (
        <LeadIntakeForm objects={objects} onSubmit={save} onCancel={() => setEditing(null)} />
      ) : (
        <Button size="sm" onClick={() => setEditing('new')}>
          Nueva configuración
        </Button>
      )}

      <ul className="space-y-3">
        {intakes.length === 0 && (
          <li className="text-tertiary text-sm">Sin configuraciones de entrada</li>
        )}
        {intakes.map((intake) =>
          editing === intake.id ? (
            <li key={intake.id}>
              <LeadIntakeForm
                intake={intake}
                objects={objects}
                onSubmit={save}
                onCancel={() => setEditing(null)}
              />
            </li>
          ) : (
            <li key={intake.id} className="border-border bg-surface rounded-lg border p-3">
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0">
                  <p className="text-primary truncate text-sm font-medium">
                    {intake.name}
                    {!intake.isActive && (
                      <span className="text-tertiary ml-2 text-xs font-normal">(pausada)</span>
                    )}
                  </p>
                  <p className="text-tertiary truncate text-xs">
                    {intake.formId ? `Formulario ${intake.formId}` : 'Cualquier formulario'} →{' '}
                    {objects.find((o) => o.id === intake.objectMetadataId)?.labelPlural ??
                      'objeto borrado'}
                    {intake.dedupeFieldName && ` · clave: ${intake.dedupeFieldName}`}
                  </p>
                  <p className="text-tertiary mt-1 text-xs">
                    {intake.stats.created} creados · {intake.stats.updated} actualizados ·{' '}
                    {intake.stats.failed} con error
                    {intake.lastReceivedAt &&
                      ` · último ${format(new Date(intake.lastReceivedAt), 'dd/MM HH:mm')}`}
                  </p>
                </div>
                <div className="flex shrink-0 items-center gap-2">
                  <button
                    type="button"
                    onClick={() => toggleActive(intake)}
                    className="text-tertiary hover:text-primary text-xs"
                  >
                    {intake.isActive ? 'Pausar' : 'Activar'}
                  </button>
                  <button
                    type="button"
                    onClick={() => setEditing(intake.id)}
                    className="text-tertiary hover:text-primary"
                    aria-label="Editar configuración"
                  >
                    <Pencil size={14} />
                  </button>
                  <button
                    type="button"
                    onClick={() => remove(intake)}
                    className="text-tertiary hover:text-danger"
                    aria-label="Borrar configuración"
                  >
                    <Trash2 size={14} />
                  </button>
                </div>
              </div>

              {intake.log.length > 0 && (
                <ul className="border-border mt-2 space-y-1 border-t pt-2">
                  {intake.log.slice(0, 5).map((l) => (
                    <li key={l.id} className="flex items-center gap-2 text-xs">
                      <span
                        className={`size-2 shrink-0 rounded-full ${l.ok ? 'bg-success' : 'bg-danger'}`}
                      />
                      <span className="text-secondary">{l.action}</span>
                      <span className="text-tertiary min-w-0 truncate">{l.message}</span>
                      <span className="text-tertiary ml-auto shrink-0">
                        {format(new Date(l.at), 'dd/MM HH:mm')}
                      </span>
                    </li>
                  ))}
                </ul>
              )}
            </li>
          ),
        )}
      </ul>
    </div>
  );
}

export default LeadIntakesPanel;
