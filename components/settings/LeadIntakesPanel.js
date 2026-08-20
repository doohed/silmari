'use client';

import { useState } from 'react';
import { toast } from 'sonner';
import { Trash2, Pencil, Copy, Check, Plus } from 'lucide-react';
import { format } from 'date-fns';
import { Button } from '@/components/ui/Button';
import { SettingsGroup, SettingsRow, SettingsEmpty } from '@/components/ui/SettingsGroup';
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
      <SettingsGroup>
        <SettingsEmpty>
          Crea antes un objeto en Modelo de datos para poder recibir leads
        </SettingsEmpty>
      </SettingsGroup>
    );
  }

  return (
    <div>
      <SettingsGroup
        title="Conexión"
        footnote="En el Zap, tras el trigger «New Lead» de Facebook Lead Ads, añade una acción Webhooks → Custom Request con método POST a esta URL, cabecera Authorization: Bearer TU_API_KEY y el lead como cuerpo JSON. La API key se crea en Ajustes → API keys con permiso records:write."
      >
        <SettingsRow stacked label="URL para Zapier o Make">
          <div className="border-border bg-sunken flex items-center gap-2 rounded-lg border px-3 py-2">
            <code className="text-primary min-w-0 flex-1 truncate text-xs">{endpoint}</code>
            <Button variant="secondary" size="sm" onClick={copyEndpoint} aria-label="Copiar URL">
              {copied ? <Check size={13} /> : <Copy size={13} />} {copied ? 'Copiada' : 'Copiar'}
            </Button>
          </div>
        </SettingsRow>
      </SettingsGroup>

      {editing === 'new' ? (
        <LeadIntakeForm objects={objects} onSubmit={save} onCancel={() => setEditing(null)} />
      ) : (
        <SettingsGroup>
          <SettingsRow
            label="Nueva configuración"
            hint="A qué objeto va cada formulario y cómo se traduce cada pregunta"
          >
            <Button size="md" onClick={() => setEditing('new')}>
              <Plus size={14} /> Crear
            </Button>
          </SettingsRow>
        </SettingsGroup>
      )}

      {intakes.length === 0 && (
        <SettingsGroup title="Formularios conectados">
          <SettingsEmpty>Todavía no has configurado ninguno</SettingsEmpty>
        </SettingsGroup>
      )}

      {intakes.map((intake) =>
        editing === intake.id ? (
          <LeadIntakeForm
            key={intake.id}
            intake={intake}
            objects={objects}
            onSubmit={save}
            onCancel={() => setEditing(null)}
          />
        ) : (
          <SettingsGroup key={intake.id} title={intake.name}>
            <SettingsRow
              label={intake.formId ? `Formulario ${intake.formId}` : 'Cualquier formulario'}
              hint={`Va a ${
                objects.find((o) => o.id === intake.objectMetadataId)?.labelPlural ??
                'objeto borrado'
              }${intake.dedupeFieldName ? ` · clave: ${intake.dedupeFieldName}` : ''}`}
            >
              <div className="flex items-center gap-2">
                <Button variant="secondary" size="sm" onClick={() => toggleActive(intake)}>
                  {intake.isActive ? 'Pausar' : 'Activar'}
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setEditing(intake.id)}
                  aria-label={`Editar ${intake.name}`}
                >
                  <Pencil size={14} />
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => remove(intake)}
                  aria-label={`Borrar ${intake.name}`}
                  className="hover:text-danger"
                >
                  <Trash2 size={14} />
                </Button>
              </div>
            </SettingsRow>

            <SettingsRow label="Estado">
              {intake.isActive ? (
                <span className="bg-chip-green text-chip-green-fg rounded-full px-2 py-0.5 text-xs">
                  Activa
                </span>
              ) : (
                <span className="bg-chip-gray text-chip-gray-fg rounded-full px-2 py-0.5 text-xs">
                  Pausada
                </span>
              )}
            </SettingsRow>

            <SettingsRow
              label="Resultados"
              hint={
                intake.lastReceivedAt
                  ? `Último lead el ${format(new Date(intake.lastReceivedAt), 'dd/MM HH:mm')}`
                  : 'Todavía no ha entrado ninguno'
              }
            >
              <span className="text-secondary text-[13px] tabular-nums">
                {intake.stats.created} creados · {intake.stats.updated} act. · {intake.stats.failed}{' '}
                con error
              </span>
            </SettingsRow>

            {intake.log.length > 0 && (
              <SettingsRow stacked label="Últimas entradas">
                <ul className="space-y-1">
                  {intake.log.slice(0, 5).map((l) => (
                    <li key={l.id} className="flex items-center gap-2 text-xs">
                      <span
                        className={`size-2 shrink-0 rounded-full ${l.ok ? 'bg-success' : 'bg-danger'}`}
                        aria-hidden
                      />
                      <span className="text-secondary">{l.action}</span>
                      <span className="text-tertiary min-w-0 truncate">{l.message}</span>
                      <span className="text-tertiary ml-auto shrink-0 tabular-nums">
                        {format(new Date(l.at), 'dd/MM HH:mm')}
                      </span>
                    </li>
                  ))}
                </ul>
              </SettingsRow>
            )}
          </SettingsGroup>
        ),
      )}
    </div>
  );
}

export default LeadIntakesPanel;
