'use client';

import { useState } from 'react';
import { Plus, X } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Select } from '@/components/ui/Select';
import { SettingsGroup, SettingsRow } from '@/components/ui/SettingsGroup';
import { canBeDedupeKey } from '@/lib/leads/dedupe';

/** Preguntas estándar de un formulario de Meta, como punto de partida. */
const DEFAULT_ROWS = [
  { source: 'full_name', fieldName: '' },
  { source: 'email', fieldName: '' },
  { source: 'phone_number', fieldName: '' },
];

/**
 * Alta/edición de una configuración de entrada de leads.
 * @param {{
 *   intake?: object,
 *   objects: Array<object>,
 *   onSubmit: (input: object) => Promise<boolean>,
 *   onCancel: () => void,
 * }} props
 */
export function LeadIntakeForm({ intake, objects, onSubmit, onCancel }) {
  const [name, setName] = useState(intake?.name ?? '');
  const [formId, setFormId] = useState(intake?.formId ?? '');
  const [objectId, setObjectId] = useState(intake?.objectMetadataId ?? objects[0]?.id ?? '');
  const [dedupe, setDedupe] = useState(intake?.dedupeFieldName ?? '');
  const [rows, setRows] = useState(intake?.mappings?.length ? intake.mappings : DEFAULT_ROWS);
  const [saving, setSaving] = useState(false);

  const object = objects.find((o) => o.id === objectId);
  // Los campos de sistema (creado por, posición…) no se rellenan desde un lead.
  const fields = (object?.fields ?? []).filter((f) => !f.isSystem && f.isActive);
  const fieldOptions = [
    { value: '', label: 'Sin asignar' },
    ...fields.map((f) => ({ value: f.name, label: f.label })),
  ];

  function setRow(i, patch) {
    setRows((prev) => prev.map((r, j) => (j === i ? { ...r, ...patch } : r)));
  }

  async function submit(e) {
    e.preventDefault();
    setSaving(true);
    const ok = await onSubmit({
      name,
      formId,
      objectMetadataId: objectId,
      dedupeFieldName: dedupe || null,
      mappings: rows.filter((r) => r.source.trim() && r.fieldName),
    });
    setSaving(false);
    if (ok) onCancel();
  }

  return (
    <form onSubmit={submit}>
      <SettingsGroup
        title={intake ? `Editar «${intake.name}»` : 'Nueva configuración'}
        footnote="En la correspondencia, a la izquierda va el nombre de la pregunta tal como está en Meta y a la derecha el campo del CRM. No distingue mayúsculas, tildes ni signos."
      >
        <SettingsRow label="Nombre">
          <Input
            aria-label="Nombre"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Campaña verano"
            className="w-56"
          />
        </SettingsRow>
        <SettingsRow label="ID del formulario" hint="Vacío = cualquier formulario">
          <Input
            aria-label="ID del formulario"
            value={formId}
            onChange={(e) => setFormId(e.target.value)}
            placeholder="123456789"
            className="w-56"
          />
        </SettingsRow>
        <SettingsRow label="Objeto destino">
          <Select
            value={objectId}
            onChange={(v) => {
              setObjectId(v);
              setDedupe('');
              setRows((prev) => prev.map((r) => ({ ...r, fieldName: '' })));
            }}
            options={objects.map((o) => ({ value: o.id, label: o.labelPlural }))}
            className="w-56"
          />
        </SettingsRow>
        <SettingsRow label="Campo clave" hint="Para no duplicar cuando el lead ya existe">
          <Select
            value={dedupe}
            onChange={setDedupe}
            options={[
              { value: '', label: 'Crear siempre uno nuevo' },
              ...fields.filter(canBeDedupeKey).map((f) => ({ value: f.name, label: f.label })),
            ]}
            className="w-56"
          />
        </SettingsRow>

        <SettingsRow stacked label="Correspondencia de campos">
          <div className="space-y-2">
            {rows.map((row, i) => (
              <div key={i} className="flex items-center gap-2">
                <Input
                  aria-label={`Pregunta ${i + 1}`}
                  value={row.source}
                  onChange={(e) => setRow(i, { source: e.target.value })}
                  placeholder="email"
                  className="font-mono"
                />
                <span className="text-tertiary shrink-0 text-xs" aria-hidden>
                  →
                </span>
                <Select
                  value={row.fieldName}
                  onChange={(v) => setRow(i, { fieldName: v })}
                  options={fieldOptions}
                  className="w-full"
                />
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={() => setRows((prev) => prev.filter((_, j) => j !== i))}
                  aria-label="Quitar correspondencia"
                  className="hover:text-danger"
                >
                  <X size={14} />
                </Button>
              </div>
            ))}
            <Button
              type="button"
              variant="secondary"
              size="sm"
              onClick={() => setRows((prev) => [...prev, { source: '', fieldName: '' }])}
            >
              <Plus size={13} /> Añadir correspondencia
            </Button>
          </div>
        </SettingsRow>

        <SettingsRow label={intake ? 'Guardar los cambios' : 'Crear la configuración'}>
          <div className="flex gap-2">
            <Button size="md" type="button" variant="ghost" onClick={onCancel}>
              Cancelar
            </Button>
            <Button size="md" type="submit" disabled={saving || !name || !objectId}>
              {intake ? 'Guardar' : 'Crear'}
            </Button>
          </div>
        </SettingsRow>
      </SettingsGroup>
    </form>
  );
}

export default LeadIntakeForm;
