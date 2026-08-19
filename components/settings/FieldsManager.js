'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { Plus, Trash2, X, ChevronUp, ChevronDown, SlidersHorizontal, Zap } from 'lucide-react';
import { toast } from 'sonner';
import { FIELD_TYPES } from '@/lib/field-types';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Label } from '@/components/ui/Label';
import { Chip } from '@/components/fields/Chip';
import { useConfirm } from '@/components/ui/ConfirmDialog';
import {
  createFieldAction,
  updateFieldAction,
  deleteFieldAction,
  rollupSourcesAction,
  priceFieldsAction,
} from '@/app/(workspace)/settings/actions';

const COLORS = ['gray', 'red', 'orange', 'yellow', 'green', 'blue', 'purple', 'pink'];
const CHOICE = new Set(['SELECT', 'MULTI_SELECT']);
// Tipos sin índice de BD: calculados (FORMULA/ROLLUP) o compuestos (LINE_ITEMS).
const NO_INDEX = new Set(['FORMULA', 'ROLLUP', 'LINE_ITEMS']);
const SELECT_CLS =
  'border-border bg-surface text-primary h-9 w-full rounded-md border px-2 text-sm';
const ROLLUP_OPS = [
  { value: 'count', label: 'Conteo' },
  { value: 'sum', label: 'Suma' },
  { value: 'avg', label: 'Media' },
  { value: 'min', label: 'Mínimo' },
  { value: 'max', label: 'Máximo' },
];

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
  const confirm = useConfirm();
  const [open, setOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [field, setField] = useState({ name: '', label: '', type: 'TEXT', isIndexed: false });
  const [options, setOptions] = useState([{ label: '', color: 'blue' }]);
  const [relationTarget, setRelationTarget] = useState('');
  const [formula, setFormula] = useState('');
  const [rollup, setRollup] = useState({
    relationFieldId: '',
    operation: 'count',
    aggregateFieldName: '',
  });
  const [rollupSources, setRollupSources] = useState(null); // null = aún sin cargar
  const [lineItemsCfg, setLineItemsCfg] = useState({ productObjectSlug: '', priceFieldName: '' });
  const [priceFields, setPriceFields] = useState([]);
  const [indexingId, setIndexingId] = useState(null);

  // Edición de opciones de un campo existente.
  const [editingId, setEditingId] = useState(null);
  const [editOptions, setEditOptions] = useState([]);
  const [savingEdit, setSavingEdit] = useState(false);

  const targets = objects.filter((o) => o.id !== object.id);

  function reset() {
    setField({ name: '', label: '', type: 'TEXT', isIndexed: false });
    setOptions([{ label: '', color: 'blue' }]);
    setRelationTarget('');
    setFormula('');
    setRollup({ relationFieldId: '', operation: 'count', aggregateFieldName: '' });
    setRollupSources(null);
    setLineItemsCfg({ productObjectSlug: '', priceFieldName: '' });
    setPriceFields([]);
    setOpen(false);
  }

  /** Cambia el tipo; al elegir ROLLUP carga (una vez) las relaciones entrantes. */
  async function changeType(type) {
    setField({ ...field, type });
    if (type === 'ROLLUP' && rollupSources === null) {
      const r = await rollupSourcesAction({ objectMetadataId: object.id });
      setRollupSources(r.ok ? r.data : []);
    }
  }

  /** Elige el objeto-catálogo de un LINE_ITEMS y carga sus campos de precio. */
  async function chooseCatalog(slug) {
    setLineItemsCfg({ productObjectSlug: slug, priceFieldName: '' });
    const obj = objects.find((o) => o.slug === slug);
    if (obj) {
      const r = await priceFieldsAction({ objectMetadataId: obj.id });
      setPriceFields(r.ok ? r.data : []);
    } else {
      setPriceFields([]);
    }
  }

  async function toggleIndex(f) {
    setIndexingId(f.id);
    const r = await updateFieldAction({ id: f.id, patch: { isIndexed: !f.isIndexed } });
    setIndexingId(null);
    if (r.ok) {
      toast.success(f.isIndexed ? 'Índice desactivado' : 'Campo indexado');
      router.refresh();
    } else {
      toast.error(r.message);
    }
  }

  async function create(e) {
    e.preventDefault();
    const payload = {
      objectMetadataId: object.id,
      name: field.name,
      label: field.label,
      type: field.type,
      isIndexed: field.isIndexed,
    };
    if (CHOICE.has(field.type)) payload.options = options.filter((o) => o.label.trim());
    if (field.type === 'RELATION') {
      if (!relationTarget) return toast.error('Elige el objeto destino de la relación');
      payload.relation = { type: 'MANY_TO_ONE', targetObjectMetadataId: relationTarget };
    }
    if (field.type === 'FORMULA') {
      if (!formula.trim()) return toast.error('Escribe una fórmula');
      payload.settings = { formula: formula.trim() };
      payload.isIndexed = false;
    }
    if (field.type === 'ROLLUP') {
      if (!rollup.relationFieldId) return toast.error('Elige la relación entrante');
      if (rollup.operation !== 'count' && !rollup.aggregateFieldName)
        return toast.error('Elige el campo numérico a agregar');
      payload.settings = {
        rollup: {
          relationFieldId: rollup.relationFieldId,
          operation: rollup.operation,
          ...(rollup.operation !== 'count'
            ? { aggregateFieldName: rollup.aggregateFieldName }
            : {}),
        },
      };
      payload.isIndexed = false;
    }
    if (field.type === 'LINE_ITEMS') {
      payload.isIndexed = false;
      if (lineItemsCfg.productObjectSlug) {
        payload.settings = {
          lineItems: {
            productObjectSlug: lineItemsCfg.productObjectSlug,
            ...(lineItemsCfg.priceFieldName ? { priceFieldName: lineItemsCfg.priceFieldName } : {}),
          },
        };
      }
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

  async function remove(f) {
    const ok = await confirm({
      title: `Borrar «${f.label}»`,
      message:
        'El campo deja de aparecer en tablas, fichas y filtros. Lo que ya esté guardado en los registros no se borra.',
      confirmLabel: 'Borrar',
      danger: true,
    });
    if (!ok) return;
    const r = await deleteFieldAction({ id: f.id });
    if (r.ok) {
      toast.success('Campo borrado');
      router.refresh();
    } else {
      toast.error(r.message);
    }
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
              onChange={(e) => changeType(e.target.value)}
              className={SELECT_CLS}
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

          {field.type === 'FORMULA' && (
            <div>
              <Label htmlFor="formula">Fórmula</Label>
              <Input
                id="formula"
                value={formula}
                onChange={(e) => setFormula(e.target.value)}
                placeholder="p. ej. amount * probability / 100"
                className="font-mono"
              />
              <p className="text-tertiary mt-1 text-xs">
                Usa los nombres de otros campos numéricos con{' '}
                <span className="font-mono">+ - * /</span> y paréntesis. Es un campo de solo
                lectura.
              </p>
            </div>
          )}

          {field.type === 'ROLLUP' && (
            <div className="space-y-2">
              <div>
                <Label htmlFor="rollup-rel">Relación entrante</Label>
                <select
                  id="rollup-rel"
                  value={rollup.relationFieldId}
                  onChange={(e) =>
                    setRollup({
                      ...rollup,
                      relationFieldId: e.target.value,
                      aggregateFieldName: '',
                    })
                  }
                  className={SELECT_CLS}
                >
                  <option value="">
                    {rollupSources === null ? 'Cargando…' : 'Elige una relación…'}
                  </option>
                  {(rollupSources ?? []).map((s) => (
                    <option key={s.relationFieldId} value={s.relationFieldId}>
                      {s.sourceObject.labelPlural} · {s.relationFieldLabel}
                    </option>
                  ))}
                </select>
                {rollupSources !== null && rollupSources.length === 0 && (
                  <p className="text-tertiary mt-1 text-xs">
                    Ningún objeto apunta a este todavía. Crea antes una relación (MANY_TO_ONE) hacia
                    este objeto.
                  </p>
                )}
              </div>
              <div>
                <Label htmlFor="rollup-op">Operación</Label>
                <select
                  id="rollup-op"
                  value={rollup.operation}
                  onChange={(e) => setRollup({ ...rollup, operation: e.target.value })}
                  className={SELECT_CLS}
                >
                  {ROLLUP_OPS.map((op) => (
                    <option key={op.value} value={op.value}>
                      {op.label}
                    </option>
                  ))}
                </select>
              </div>
              {rollup.operation !== 'count' && (
                <div>
                  <Label htmlFor="rollup-field">Campo a agregar</Label>
                  <select
                    id="rollup-field"
                    value={rollup.aggregateFieldName}
                    onChange={(e) => setRollup({ ...rollup, aggregateFieldName: e.target.value })}
                    className={SELECT_CLS}
                  >
                    <option value="">Elige un campo numérico…</option>
                    {(
                      rollupSources?.find((s) => s.relationFieldId === rollup.relationFieldId)
                        ?.numericFields ?? []
                    ).map((nf) => (
                      <option key={nf.name} value={nf.name}>
                        {nf.label}
                      </option>
                    ))}
                  </select>
                </div>
              )}
              <p className="text-tertiary text-xs">
                Agrega los registros relacionados que apuntan a este. Es un campo de solo lectura.
              </p>
            </div>
          )}

          {field.type === 'LINE_ITEMS' && (
            <div className="space-y-2">
              <div>
                <Label htmlFor="li-catalog">Catálogo de productos (opcional)</Label>
                <select
                  id="li-catalog"
                  value={lineItemsCfg.productObjectSlug}
                  onChange={(e) => chooseCatalog(e.target.value)}
                  className={SELECT_CLS}
                >
                  <option value="">Sin catálogo (líneas libres)</option>
                  {targets.map((o) => (
                    <option key={o.id} value={o.slug}>
                      {o.labelPlural}
                    </option>
                  ))}
                </select>
              </div>
              {lineItemsCfg.productObjectSlug && (
                <div>
                  <Label htmlFor="li-price">Campo de precio</Label>
                  <select
                    id="li-price"
                    value={lineItemsCfg.priceFieldName}
                    onChange={(e) =>
                      setLineItemsCfg({ ...lineItemsCfg, priceFieldName: e.target.value })
                    }
                    className={SELECT_CLS}
                  >
                    <option value="">Sin autorrelleno de precio</option>
                    {priceFields.map((pf) => (
                      <option key={pf.name} value={pf.name}>
                        {pf.label}
                      </option>
                    ))}
                  </select>
                </div>
              )}
              <p className="text-tertiary text-xs">
                Las líneas se editan en la ficha. Con catálogo, cada línea puede elegir un producto
                que autorellena descripción y precio.
              </p>
            </div>
          )}

          {!NO_INDEX.has(field.type) && (
            <label className="text-secondary flex items-center gap-2 text-xs">
              <input
                type="checkbox"
                checked={field.isIndexed}
                onChange={(e) => setField({ ...field, isIndexed: e.target.checked })}
                className="accent-accent size-3.5"
              />
              Indexar para filtrar y ordenar rápido
            </label>
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
                {!f.isSystem && (
                  <button
                    type="button"
                    onClick={() => toggleIndex(f)}
                    disabled={indexingId === f.id}
                    className={f.isIndexed ? 'text-accent' : 'text-tertiary hover:text-primary'}
                    aria-label={f.isIndexed ? 'Quitar índice' : 'Indexar campo'}
                    title={
                      f.isIndexed
                        ? 'Indexado (filtrar/ordenar rápido) · clic para quitar'
                        : 'Indexar para filtrar y ordenar rápido'
                    }
                  >
                    <Zap size={14} />
                  </button>
                )}
                {editable && (
                  <button
                    type="button"
                    onClick={() => (editingId === f.id ? setEditingId(null) : startEdit(f))}
                    className={
                      editingId === f.id ? 'text-accent' : 'text-tertiary hover:text-primary'
                    }
                    aria-label="Editar opciones"
                    title="Editar opciones"
                  >
                    <SlidersHorizontal size={14} />
                  </button>
                )}
                {deletable && (
                  <button
                    type="button"
                    onClick={() => remove(f)}
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
