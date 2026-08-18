'use client';

import { useMemo, useState } from 'react';
import { toast } from 'sonner';
import { Trash2, Copy, ExternalLink } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Label } from '@/components/ui/Label';
import { Select } from '@/components/ui/Select';
import { useConfirm } from '@/components/ui/ConfirmDialog';
import {
  listFormsAction,
  createFormAction,
  toggleFormAction,
  deleteFormAction,
} from '@/app/(workspace)/settings/forms/actions';

export function FormsPanel({ initialForms, objects, appUrl }) {
  const confirm = useConfirm();
  const [forms, setForms] = useState(initialForms);
  const [name, setName] = useState('');
  const [objectSlug, setObjectSlug] = useState(objects[0]?.slug ?? '');
  const [sel, setSel] = useState({}); // fieldName -> { included, required }
  const [dedupeFieldName, setDedupeFieldName] = useState('');
  const [submitLabel, setSubmitLabel] = useState('Enviar');
  const [successMessage, setSuccessMessage] = useState('¡Gracias! Hemos recibido tu mensaje.');
  const [saving, setSaving] = useState(false);

  const object = useMemo(() => objects.find((o) => o.slug === objectSlug), [objects, objectSlug]);
  const fields = useMemo(() => object?.fields ?? [], [object]);

  const included = fields.filter((f) => sel[f.name]?.included);

  function toggleField(name) {
    setSel((s) => {
      const cur = s[name] ?? { included: false, required: false };
      return { ...s, [name]: { ...cur, included: !cur.included } };
    });
  }
  function toggleRequired(name) {
    setSel((s) => {
      const cur = s[name] ?? { included: true, required: false };
      return { ...s, [name]: { ...cur, required: !cur.required } };
    });
  }

  async function refresh() {
    const r = await listFormsAction();
    if (r.ok) setForms(r.data);
  }

  function resetForm() {
    setName('');
    setSel({});
    setDedupeFieldName('');
    setSubmitLabel('Enviar');
    setSuccessMessage('¡Gracias! Hemos recibido tu mensaje.');
  }

  async function create(e) {
    e.preventDefault();
    setSaving(true);
    const r = await createFormAction({
      name,
      objectMetadataId: object?.id,
      fields: included.map((f) => ({
        fieldName: f.name,
        label: f.label,
        required: Boolean(sel[f.name]?.required),
      })),
      dedupeFieldName: dedupeFieldName || null,
      submitLabel,
      successMessage,
    });
    setSaving(false);
    if (!r.ok) return toast.error(r.message);
    resetForm();
    refresh();
    toast.success('Formulario creado');
  }

  async function toggle(id) {
    const r = await toggleFormAction({ id });
    if (r.ok) setForms((prev) => prev.map((f) => (f.id === id ? r.data : f)));
  }

  async function remove(id, formName) {
    const ok = await confirm({
      title: 'Borrar formulario',
      message: `Se eliminará "${formName}". El enlace dejará de funcionar.`,
      confirmLabel: 'Borrar',
      danger: true,
    });
    if (!ok) return;
    const r = await deleteFormAction({ id });
    if (r.ok) refresh();
  }

  function copy(text, msg) {
    navigator.clipboard?.writeText(text).then(
      () => toast.success(msg),
      () => toast.error('No se pudo copiar'),
    );
  }

  const hostedUrl = (slug) => `${appUrl}/forms/${slug}`;
  const embedSnippet = (slug) =>
    `<iframe src="${hostedUrl(slug)}" width="100%" height="600" style="border:0" title="Formulario"></iframe>`;
  const objectLabel = (id) => objects.find((o) => o.id === id)?.labelSingular ?? '';

  return (
    <div className="space-y-6">
      <form onSubmit={create} className="border-border bg-bg space-y-4 rounded-lg border p-4">
        <div className="grid grid-cols-2 gap-3">
          <div>
            <Label htmlFor="form-name">Nombre</Label>
            <Input
              id="form-name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="p. ej. Contacto web"
            />
          </div>
          <div>
            <Label>Objeto destino</Label>
            <Select
              value={objectSlug}
              onChange={(v) => {
                setObjectSlug(v);
                setSel({});
                setDedupeFieldName('');
              }}
              options={objects.map((o) => ({ value: o.slug, label: o.labelSingular }))}
            />
          </div>
        </div>

        <div>
          <Label className="mb-1.5">Campos del formulario</Label>
          <div className="border-border divide-border divide-y rounded-md border">
            {fields.length === 0 && (
              <p className="text-tertiary p-3 text-xs">Este objeto no tiene campos editables</p>
            )}
            {fields.map((f) => {
              const on = Boolean(sel[f.name]?.included);
              return (
                <div key={f.name} className="flex items-center gap-3 px-3 py-2">
                  <label className="flex flex-1 items-center gap-2 text-sm">
                    <input type="checkbox" checked={on} onChange={() => toggleField(f.name)} />
                    <span className="text-primary">{f.label}</span>
                  </label>
                  {on && (
                    <label className="text-secondary flex items-center gap-1.5 text-xs">
                      <input
                        type="checkbox"
                        checked={Boolean(sel[f.name]?.required)}
                        onChange={() => toggleRequired(f.name)}
                      />
                      Obligatorio
                    </label>
                  )}
                </div>
              );
            })}
          </div>
        </div>

        {included.length > 0 && (
          <div>
            <Label>Campo clave (deduplicación, opcional)</Label>
            <Select
              value={dedupeFieldName}
              onChange={setDedupeFieldName}
              options={[
                { value: '', label: 'Crear siempre un registro nuevo' },
                ...included.map((f) => ({ value: f.name, label: f.label })),
              ]}
            />
            <p className="text-tertiary mt-1 text-xs">
              Si eliges uno, un envío con el mismo valor actualiza el registro existente en vez de
              duplicarlo.
            </p>
          </div>
        )}

        <div className="grid grid-cols-2 gap-3">
          <div>
            <Label htmlFor="form-submit">Texto del botón</Label>
            <Input
              id="form-submit"
              value={submitLabel}
              onChange={(e) => setSubmitLabel(e.target.value)}
            />
          </div>
          <div>
            <Label htmlFor="form-success">Mensaje de éxito</Label>
            <Input
              id="form-success"
              value={successMessage}
              onChange={(e) => setSuccessMessage(e.target.value)}
            />
          </div>
        </div>

        <Button size="sm" type="submit" disabled={saving || !name.trim() || included.length === 0}>
          {saving ? 'Creando…' : 'Crear formulario'}
        </Button>
      </form>

      <ul className="space-y-3">
        {forms.length === 0 && <li className="text-tertiary text-sm">Sin formularios</li>}
        {forms.map((f) => (
          <li key={f.id} className="border-border bg-surface rounded-lg border p-3">
            <div className="flex items-start justify-between gap-2">
              <div className="min-w-0">
                <p className="text-primary truncate text-sm font-medium">{f.name}</p>
                <p className="text-secondary mt-0.5 text-xs">
                  {objectLabel(f.objectMetadataId)} · {f.fields.length}{' '}
                  {f.fields.length === 1 ? 'campo' : 'campos'} · {f.stats.submissions} envíos
                </p>
              </div>
              <div className="flex shrink-0 items-center gap-2">
                <button
                  type="button"
                  onClick={() => toggle(f.id)}
                  className={`rounded-md border px-2 py-0.5 text-xs ${f.isActive ? 'border-accent text-accent' : 'border-border text-tertiary'}`}
                >
                  {f.isActive ? 'Activo' : 'Inactivo'}
                </button>
                <button
                  type="button"
                  onClick={() => remove(f.id, f.name)}
                  className="text-tertiary hover:text-danger"
                  aria-label="Borrar formulario"
                >
                  <Trash2 size={14} />
                </button>
              </div>
            </div>

            <div className="border-border mt-2 space-y-2 border-t pt-2">
              <div className="flex items-center gap-2">
                <code className="text-tertiary bg-chip-gray min-w-0 flex-1 truncate rounded px-2 py-1 text-xs">
                  {hostedUrl(f.slug)}
                </code>
                <a
                  href={hostedUrl(f.slug)}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="text-tertiary hover:text-primary"
                  aria-label="Abrir formulario"
                >
                  <ExternalLink size={14} />
                </a>
                <button
                  type="button"
                  onClick={() => copy(hostedUrl(f.slug), 'Enlace copiado')}
                  className="text-tertiary hover:text-primary"
                  aria-label="Copiar enlace"
                >
                  <Copy size={14} />
                </button>
              </div>
              <button
                type="button"
                onClick={() => copy(embedSnippet(f.slug), 'Snippet copiado')}
                className="text-accent flex items-center gap-1 text-xs"
              >
                <Copy size={12} /> Copiar snippet para embeber
              </button>
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
}

export default FormsPanel;
