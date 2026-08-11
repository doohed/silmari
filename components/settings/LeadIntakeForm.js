'use client';

import { useState } from 'react';
import { Plus, X } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Label } from '@/components/ui/Label';
import { Select } from '@/components/ui/Select';
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
    <form onSubmit={submit} className="border-border bg-bg space-y-4 rounded-lg border p-4">
      <div className="grid grid-cols-2 gap-3">
        <div>
          <Label htmlFor="intake-name">Nombre</Label>
          <Input
            id="intake-name"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Campaña verano"
          />
        </div>
        <div>
          <Label htmlFor="intake-form">ID del formulario</Label>
          <Input
            id="intake-form"
            value={formId}
            onChange={(e) => setFormId(e.target.value)}
            placeholder="Vacío = cualquier formulario"
          />
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div>
          <Label>Objeto destino</Label>
          <Select
            value={objectId}
            onChange={(v) => {
              setObjectId(v);
              setDedupe('');
              setRows((prev) => prev.map((r) => ({ ...r, fieldName: '' })));
            }}
            options={objects.map((o) => ({ value: o.id, label: o.labelPlural }))}
          />
        </div>
        <div>
          <Label>Campo clave (duplicados)</Label>
          <Select
            value={dedupe}
            onChange={setDedupe}
            options={[
              { value: '', label: 'Crear siempre un registro nuevo' },
              ...fields.filter(canBeDedupeKey).map((f) => ({ value: f.name, label: f.label })),
            ]}
          />
        </div>
      </div>

      <div>
        <Label>Correspondencia de campos</Label>
        <p className="text-tertiary mb-2 text-xs">
          A la izquierda, el nombre de la pregunta en Meta; a la derecha, el campo del CRM. No
          distingue mayúsculas, tildes ni signos.
        </p>
        <div className="space-y-2">
          {rows.map((row, i) => (
            <div key={i} className="flex items-center gap-2">
              <Input
                value={row.source}
                onChange={(e) => setRow(i, { source: e.target.value })}
                placeholder="email"
                className="h-10 font-mono"
              />
              <span className="text-tertiary shrink-0 text-xs">→</span>
              <Select
                value={row.fieldName}
                onChange={(v) => setRow(i, { fieldName: v })}
                options={fieldOptions}
                className="w-full"
              />
              <button
                type="button"
                onClick={() => setRows((prev) => prev.filter((_, j) => j !== i))}
                className="text-tertiary hover:text-danger shrink-0"
                aria-label="Quitar correspondencia"
              >
                <X size={14} />
              </button>
            </div>
          ))}
        </div>
        <button
          type="button"
          onClick={() => setRows((prev) => [...prev, { source: '', fieldName: '' }])}
          className="text-accent mt-2 inline-flex items-center gap-1 text-xs"
        >
          <Plus size={13} /> Añadir correspondencia
        </button>
      </div>

      <div className="flex gap-2">
        <Button size="sm" type="submit" disabled={saving || !name || !objectId}>
          {intake ? 'Guardar cambios' : 'Crear configuración'}
        </Button>
        <Button size="sm" type="button" variant="ghost" onClick={onCancel}>
          Cancelar
        </Button>
      </div>
    </form>
  );
}

export default LeadIntakeForm;
