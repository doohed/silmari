'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Plus, Trash2, X, ChevronUp, ChevronDown, SlidersHorizontal } from 'lucide-react';
import { toast } from 'sonner';
import { FIELD_TYPES } from '@/lib/field-types';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Label } from '@/components/ui/Label';
import { Chip } from '@/components/fields/Chip';
import {
  createFieldAction,
  updateFieldAction,
  deleteFieldAction,
} from '@/app/(workspace)/settings/actions';

const COLORS = ['gray', 'red', 'orange', 'yellow', 'green', 'blue', 'purple', 'pink'];
const CHOICE = new Set(['SELECT', 'MULTI_SELECT']);

/**
 * Editor de opciones de un campo SELECT/MULTI_SELECT: renombrar, recolorear,
 * reordenar (flechas), añadir y quitar. Preserva `id`/`value` de las opciones
 * existentes para no desligar los registros que ya las usan.
 */
function OptionRows({ options, setOptions }) {
  const set = (i, patch) => setOptions(options.map((o, j) => (j === i ? { ...o, ...patch } : o)));
  const move = (i, dir) => {
    const j = i + dir;
    if (j < 0 || j >= options.length) return;
    const next = [...options];
    [next[i], next[j]] = [next[j], next[i]];
    setOptions(next);
  };

  return (
    <div className="space-y-2">
      {options.map((opt, i) => (
        <div key={opt.id ?? i} className="flex items-center gap-2">
          <div className="text-tertiary flex flex-col">
            <button
              type="button"
              onClick={() => move(i, -1)}
              disabled={i === 0}
              className="hover:text-primary disabled:opacity-30"
              aria-label="Subir opción"
            >
              <ChevronUp size={13} />
            </button>
            <button
              type="button"
              onClick={() => move(i, 1)}
              disabled={i === options.length - 1}
              className="hover:text-primary disabled:opacity-30"
              aria-label="Bajar opción"
            >
              <ChevronDown size={13} />
            </button>
          </div>
          <Input
            value={opt.label}
            onChange={(e) => set(i, { label: e.target.value })}
            placeholder="Opción"
          />
          <div className="flex gap-1">
            {COLORS.map((c) => (
              <button
                key={c}
                type="button"
                aria-label={`Color ${c}`}
                onClick={() => set(i, { color: c })}
                className={`size-5 rounded-full bg-chip-${c} ${opt.color === c ? 'ring-accent ring-2' : ''}`}
              />
            ))}
          </div>
          {options.length > 1 && (
            <button
              type="button"
              onClick={() => setOptions(options.filter((_, j) => j !== i))}
              className="text-tertiary hover:text-danger"
              aria-label="Quitar opción"
            >
              <X size={14} />
            </button>
          )}
        </div>
      ))}
      <button
        type="button"
        onClick={() => setOptions([...options, { label: '', color: 'gray' }])}
        className="text-accent text-xs font-medium"
      >
        + Añadir opción
      </button>
    </div>
  );
}

export function FieldsManager({ object, objects }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [field, setField] = useState({ name: '', label: '', type: 'TEXT' });
  const [options, setOptions] = useState([{ label: '', color: 'blue' }]);
  const [relationTarget, setRelationTarget] = useState('');

  // Edición de opciones de un campo existente.
  const [editingId, setEditingId] = useState(null);
  const [editOptions, setEditOptions] = useState([]);
  const [savingEdit, setSavingEdit] = useState(false);

  const targets = objects.filter((o) => o.id !== object.id);

  function reset() {
    setField({ name: '', label: '', type: 'TEXT' });
    setOptions([{ label: '', color: 'blue' }]);
    setRelationTarget('');
    setOpen(false);
  }

  async function create(e) {
    e.preventDefault();
    const payload = {
      objectMetadataId: object.id,
      name: field.name,
      label: field.label,
      type: field.type,
    };
    if (CHOICE.has(field.type)) payload.options = options.filter((o) => o.label.trim());
    if (field.type === 'RELATION') {
      if (!relationTarget) return toast.error('Elige el objeto destino de la relación');
      payload.relation = { type: 'MANY_TO_ONE', targetObjectMetadataId: relationTarget };
    }
    setSaving(true);
    const r = await createFieldAction(payload);
    setSaving(false);
    if (r.ok) {
      toast.success('Campo creado');
      reset();
      router.refresh();
    } else {
      toast.error(r.message);
    }
  }

  function startEdit(f) {
    setOpen(false);
    setEditingId(f.id);
    setEditOptions(
      [...(f.options ?? [])]
        .sort((a, b) => (a.position ?? 0) - (b.position ?? 0))
        .map((o) => ({ id: o.id, value: o.value, label: o.label, color: o.color ?? 'gray' })),
    );
  }

  async function saveOptions() {
    const payload = editOptions
      .filter((o) => o.label.trim())
      .map((o, i) => ({
        id: o.id,
        value: o.value,
        label: o.label.trim(),
        color: o.color,
        position: i,
      }));
    if (payload.length === 0) return toast.error('Añade al menos una opción');
    setSavingEdit(true);
    const r = await updateFieldAction({ id: editingId, patch: { options: payload } });
    setSavingEdit(false);
    if (r.ok) {
      toast.success('Opciones actualizadas');
      setEditingId(null);
      router.refresh();
    } else {
      toast.error(r.message);
    }
  }

  async function remove(id) {
    const r = await deleteFieldAction({ id });
    if (r.ok) router.refresh();
    else toast.error(r.message);
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-primary text-sm font-semibold">Campos</h2>
        <Button size="sm" onClick={() => setOpen((o) => !o)}>
          <Plus size={14} /> Añadir campo
        </Button>
      </div>

      {open && (
        <form onSubmit={create} className="border-border bg-bg space-y-3 rounded-lg border p-4">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label htmlFor="fname">Nombre técnico (camelCase)</Label>
              <Input
                id="fname"
                value={field.name}
                onChange={(e) => setField({ ...field, name: e.target.value })}
                placeholder="precio"
              />
            </div>
            <div>
              <Label htmlFor="flabel">Etiqueta</Label>
              <Input
                id="flabel"
                value={field.label}
                onChange={(e) => setField({ ...field, label: e.target.value })}
                placeholder="Precio"
              />
            </div>
          </div>

          <div>
            <Label htmlFor="ftype">Tipo</Label>
            <select
              id="ftype"
              value={field.type}
              onChange={(e) => setField({ ...field, type: e.target.value })}
              className="border-border bg-surface text-primary h-9 w-full rounded-md border px-2 text-sm"
            >
              {FIELD_TYPES.map((t) => (
                <option key={t} value={t}>
                  {t}
                </option>
              ))}
            </select>
          </div>

          {CHOICE.has(field.type) && (
            <div className="space-y-2">
              <Label>Opciones</Label>
              <OptionRows options={options} setOptions={setOptions} />
            </div>
          )}

          {field.type === 'RELATION' && (
            <div>
              <Label htmlFor="rel">Objeto destino (MANY_TO_ONE)</Label>
              <select
                id="rel"
                value={relationTarget}
                onChange={(e) => setRelationTarget(e.target.value)}
                className="border-border bg-surface text-primary h-9 w-full rounded-md border px-2 text-sm"
              >
                <option value="">Elige un objeto…</option>
                {targets.map((o) => (
                  <option key={o.id} value={o.id}>
                    {o.labelSingular}
                  </option>
                ))}
              </select>
            </div>
          )}

          <Button size="sm" type="submit" disabled={saving}>
            {saving ? 'Creando…' : 'Crear campo'}
          </Button>
        </form>
      )}

      <ul className="border-border bg-surface divide-border divide-y rounded-lg border">
        {object.fields.map((f) => {
          const isIdentifier = f.id === object.labelIdentifierFieldId;
          const deletable = !f.isSystem && !isIdentifier;
          const editable = CHOICE.has(f.type);
          return (
            <li key={f.id}>
              <div className="flex items-center gap-3 px-4 py-2.5">
                <div className="min-w-0 flex-1">
                  <p className="text-primary truncate text-sm font-medium">
                    {f.label}
                    {isIdentifier && (
                      <span className="text-tertiary ml-1 text-xs">(identificador)</span>
                    )}
                    {f.isSystem && <span className="text-tertiary ml-1 text-xs">(sistema)</span>}
                  </p>
                  <p className="text-tertiary font-mono text-xs">{f.name}</p>
                </div>
                <Chip label={f.type} />
                {editable && (
                  <button
                    type="button"
                    onClick={() => (editingId === f.id ? setEditingId(null) : startEdit(f))}
                    className={editingId === f.id ? 'text-accent' : 'text-tertiary hover:text-primary'}
                    aria-label="Editar opciones"
                    title="Editar opciones"
                  >
                    <SlidersHorizontal size={14} />
                  </button>
                )}
                {deletable && (
                  <button
                    type="button"
                    onClick={() => remove(f.id)}
                    className="text-tertiary hover:text-danger"
                    aria-label="Borrar campo"
                  >
                    <Trash2 size={14} />
                  </button>
                )}
              </div>

              {editingId === f.id && (
                <div className="border-border bg-bg space-y-3 border-t px-4 py-3">
                  <p className="text-secondary text-xs font-medium">Opciones de «{f.label}»</p>
                  <OptionRows options={editOptions} setOptions={setEditOptions} />
                  <div className="flex items-center gap-2">
                    <Button size="sm" onClick={saveOptions} disabled={savingEdit}>
                      {savingEdit ? 'Guardando…' : 'Guardar opciones'}
                    </Button>
                    <Button size="sm" variant="ghost" onClick={() => setEditingId(null)}>
                      Cancelar
                    </Button>
                  </div>
                  <p className="text-tertiary text-xs">
                    Renombrar o recolorear no afecta a los registros. Si quitas una opción, los
                    registros que la usaban conservan su valor pero quedará sin etiqueta.
                  </p>
                </div>
              )}
            </li>
          );
        })}
      </ul>
    </div>
  );
}

export default FieldsManager;
