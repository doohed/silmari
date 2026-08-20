'use client';

import { useMemo, useState } from 'react';
import { toast } from 'sonner';
import { Trash2, Copy, ExternalLink } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Select } from '@/components/ui/Select';
import { SettingsGroup, SettingsRow, SettingsEmpty } from '@/components/ui/SettingsGroup';
import { useConfirm } from '@/components/ui/ConfirmDialog';
import {
  listFormsAction,
  createFormAction,
  toggleFormAction,
  deleteFormAction,
} from '@/app/(workspace)/settings/forms/actions';

/**
 * Formularios web públicos, en listas agrupadas.
 *
 * **Cada formulario ya creado es su propio grupo**, con su nombre de título: la
 * versión anterior metía en una tarjeta el nombre, las estadísticas, el
 * interruptor, el enlace y el snippet, y con dos o tres seguidos no se sabía
 * dónde acababa uno y empezaba el siguiente.
 */
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
    <div>
      <SettingsGroup
        title="Nuevo formulario"
        footnote="Quien lo rellena no necesita cuenta. Cada envío crea o actualiza un registro del objeto que elijas."
      >
        <SettingsRow label="Nombre">
          <Input
            aria-label="Nombre"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="p. ej. Contacto web"
            className="w-56"
          />
        </SettingsRow>
        <SettingsRow label="Objeto destino">
          <Select
            value={objectSlug}
            onChange={(v) => {
              setObjectSlug(v);
              setSel({});
              setDedupeFieldName('');
            }}
            options={objects.map((o) => ({ value: o.slug, label: o.labelSingular }))}
            className="w-56"
          />
        </SettingsRow>

        <SettingsRow stacked label="Campos del formulario">
          <div className="border-border divide-border divide-y rounded-lg border">
            {fields.length === 0 && (
              <p className="text-tertiary px-3 py-2 text-xs">
                Este objeto no tiene campos editables
              </p>
            )}
            {fields.map((f) => {
              const on = Boolean(sel[f.name]?.included);
              return (
                <div key={f.name} className="flex items-center gap-3 px-3 py-2">
                  <label className="flex flex-1 items-center gap-2 text-[13px]">
                    <input
                      type="checkbox"
                      className="size-4"
                      checked={on}
                      onChange={() => toggleField(f.name)}
                    />
                    <span className="text-primary">{f.label}</span>
                  </label>
                  {on && (
                    <label className="text-secondary flex items-center gap-1.5 text-xs">
                      <input
                        type="checkbox"
                        className="size-3.5"
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
        </SettingsRow>

        {included.length > 0 && (
          <SettingsRow
            label="Campo clave"
            hint="Un envío con el mismo valor actualiza el registro en vez de duplicarlo"
          >
            <Select
              value={dedupeFieldName}
              onChange={setDedupeFieldName}
              options={[
                { value: '', label: 'Crear siempre uno nuevo' },
                ...included.map((f) => ({ value: f.name, label: f.label })),
              ]}
              className="w-56"
            />
          </SettingsRow>
        )}

        <SettingsRow label="Texto del botón">
          <Input
            aria-label="Texto del botón"
            value={submitLabel}
            onChange={(e) => setSubmitLabel(e.target.value)}
            className="w-56"
          />
        </SettingsRow>
        <SettingsRow label="Mensaje de éxito">
          <Input
            aria-label="Mensaje de éxito"
            value={successMessage}
            onChange={(e) => setSuccessMessage(e.target.value)}
            className="w-56"
          />
        </SettingsRow>

        <SettingsRow label="Crear el formulario">
          <Button
            size="md"
            onClick={create}
            disabled={saving || !name.trim() || included.length === 0}
          >
            {saving ? 'Creando…' : 'Crear formulario'}
          </Button>
        </SettingsRow>
      </SettingsGroup>

      {forms.length === 0 && (
        <SettingsGroup title="Formularios">
          <SettingsEmpty>Todavía no has creado ninguno</SettingsEmpty>
        </SettingsGroup>
      )}

      {forms.map((f) => (
        <SettingsGroup key={f.id} title={f.name}>
          <SettingsRow
            label={objectLabel(f.objectMetadataId)}
            hint={`${f.fields.length} ${f.fields.length === 1 ? 'campo' : 'campos'} · ${f.stats.submissions} envíos`}
          >
            <Button
              variant="secondary"
              size="sm"
              onClick={() => toggle(f.id)}
              aria-pressed={f.isActive}
              className={f.isActive ? 'border-accent text-accent' : 'text-tertiary'}
            >
              {f.isActive ? 'Activo' : 'Inactivo'}
            </Button>
          </SettingsRow>

          <SettingsRow stacked label="Enlace público">
            <div className="flex items-center gap-2">
              <code className="text-tertiary bg-sunken min-w-0 flex-1 truncate rounded-md px-2 py-1 text-xs">
                {hostedUrl(f.slug)}
              </code>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => window.open(hostedUrl(f.slug), '_blank', 'noopener,noreferrer')}
                aria-label={`Abrir ${f.name}`}
              >
                <ExternalLink size={14} />
              </Button>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => copy(hostedUrl(f.slug), 'Enlace copiado')}
                aria-label="Copiar enlace"
              >
                <Copy size={14} />
              </Button>
            </div>
          </SettingsRow>

          <SettingsRow label="Insertar en tu web" hint="Un iframe listo para pegar">
            <Button
              variant="secondary"
              size="sm"
              onClick={() => copy(embedSnippet(f.slug), 'Snippet copiado')}
            >
              <Copy size={13} /> Copiar snippet
            </Button>
          </SettingsRow>

          <SettingsRow label="Eliminar formulario" hint="El enlace dejará de funcionar">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => remove(f.id, f.name)}
              aria-label={`Borrar ${f.name}`}
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

export default FormsPanel;
