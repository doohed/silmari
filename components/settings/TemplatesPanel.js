'use client';

import { useMemo, useRef, useState } from 'react';
import { toast } from 'sonner';
import { Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Select } from '@/components/ui/Select';
import { SettingsGroup, SettingsRow, SettingsEmpty } from '@/components/ui/SettingsGroup';
import { useConfirm } from '@/components/ui/ConfirmDialog';
import { renderTemplate } from '@/lib/templates/render';
import {
  listTemplatesAction,
  createTemplateAction,
  deleteTemplateAction,
} from '@/app/(workspace)/settings/templates/actions';

const CHANNELS = [
  { value: 'EMAIL', label: 'Email' },
  { value: 'WHATSAPP', label: 'WhatsApp' },
  { value: 'GENERIC', label: 'Genérica' },
];
const channelLabel = (v) => CHANNELS.find((c) => c.value === v)?.label ?? v;

const TEXTAREA =
  'bg-surface text-primary placeholder:text-tertiary border-border focus:border-accent focus:ring-accent/15 min-h-28 w-full rounded-md border px-3 py-2 text-[13px] focus:ring-2 focus:outline-none';

export function TemplatesPanel({ initialTemplates, objects }) {
  const confirm = useConfirm();
  const bodyRef = useRef(null);
  const [templates, setTemplates] = useState(initialTemplates);
  const [name, setName] = useState('');
  const [channel, setChannel] = useState('EMAIL');
  const [objectSlug, setObjectSlug] = useState('');
  const [subject, setSubject] = useState('');
  const [body, setBody] = useState('');
  const [saving, setSaving] = useState(false);

  const object = useMemo(() => objects.find((o) => o.slug === objectSlug), [objects, objectSlug]);
  const fields = useMemo(() => object?.fields ?? [], [object]);

  // Variables de muestra para la vista previa: cada campo por su etiqueta entre
  // comillas angulares, más el actor. Refleja la estructura sin datos reales.
  const previewVars = useMemo(() => {
    const v = { 'actor.name': '«Tú»' };
    for (const f of fields) v[f.name] = `«${f.label}»`;
    return v;
  }, [fields]);

  async function refresh() {
    const r = await listTemplatesAction();
    if (r.ok) setTemplates(r.data);
  }

  /** Inserta `{{name}}` en el cuerpo, en la posición del cursor. */
  function insertVariable(fieldName) {
    const token = `{{${fieldName}}}`;
    const el = bodyRef.current;
    if (!el) {
      setBody((b) => b + token);
      return;
    }
    const start = el.selectionStart ?? body.length;
    const end = el.selectionEnd ?? body.length;
    const next = body.slice(0, start) + token + body.slice(end);
    setBody(next);
    // Recoloca el cursor tras el token en el próximo tick.
    requestAnimationFrame(() => {
      el.focus();
      el.selectionStart = el.selectionEnd = start + token.length;
    });
  }

  function resetForm() {
    setName('');
    setSubject('');
    setBody('');
  }

  async function create(e) {
    e.preventDefault();
    setSaving(true);
    const r = await createTemplateAction({
      name,
      channel,
      objectSlug: objectSlug || null,
      subject,
      body,
    });
    setSaving(false);
    if (!r.ok) return toast.error(r.message);
    resetForm();
    refresh();
    toast.success('Plantilla creada');
  }

  async function remove(id, tplName) {
    const ok = await confirm({
      title: 'Borrar plantilla',
      message: `Se eliminará "${tplName}".`,
      confirmLabel: 'Borrar',
      danger: true,
    });
    if (!ok) return;
    const r = await deleteTemplateAction({ id });
    if (r.ok) refresh();
  }

  return (
    <div>
      <SettingsGroup
        title="Nueva plantilla"
        footnote="Las variables {{campo}} se rellenan con los datos del registro al escribir el mensaje. Elige un objeto para ver cuáles hay disponibles."
      >
        <SettingsRow label="Nombre">
          <Input
            aria-label="Nombre"
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="p. ej. Bienvenida"
            className="w-56"
          />
        </SettingsRow>
        <SettingsRow label="Canal">
          <Select value={channel} onChange={setChannel} options={CHANNELS} className="w-56" />
        </SettingsRow>
        <SettingsRow label="Objeto" hint="De dónde salen las variables. Opcional">
          <Select
            value={objectSlug}
            onChange={setObjectSlug}
            options={[
              { value: '', label: 'Sin objeto' },
              ...objects.map((o) => ({ value: o.slug, label: o.labelSingular })),
            ]}
            className="w-56"
          />
        </SettingsRow>

        {channel === 'EMAIL' && (
          <SettingsRow label="Asunto">
            <Input
              aria-label="Asunto"
              value={subject}
              onChange={(e) => setSubject(e.target.value)}
              placeholder="Hola {{name}}"
              className="w-56"
            />
          </SettingsRow>
        )}

        <SettingsRow stacked label="Mensaje">
          <textarea
            ref={bodyRef}
            aria-label="Mensaje"
            value={body}
            onChange={(e) => setBody(e.target.value)}
            placeholder="Hola {{name}}, gracias por tu interés…"
            className={TEXTAREA}
          />
        </SettingsRow>

        {fields.length > 0 && (
          <SettingsRow stacked label="Insertar variable">
            <div className="flex flex-wrap gap-1.5">
              {fields.map((f) => (
                <button
                  key={f.name}
                  type="button"
                  onClick={() => insertVariable(f.name)}
                  className="press border-border text-secondary hover:border-accent hover:text-primary rounded-md border px-2 py-0.5 font-mono text-xs"
                >
                  {`{{${f.name}}}`}
                </button>
              ))}
            </div>
          </SettingsRow>
        )}

        {(subject || body) && (
          <SettingsRow stacked label="Vista previa">
            <div className="border-border bg-sunken rounded-lg border px-3 py-2">
              {channel === 'EMAIL' && subject && (
                <p className="text-primary mb-1 text-[13px] font-medium">
                  {renderTemplate(subject, previewVars)}
                </p>
              )}
              <p className="text-secondary text-[13px] whitespace-pre-wrap">
                {renderTemplate(body, previewVars)}
              </p>
            </div>
          </SettingsRow>
        )}

        <SettingsRow label="Crear la plantilla">
          <Button size="md" onClick={create} disabled={saving || !name.trim() || !body.trim()}>
            {saving ? 'Creando…' : 'Crear plantilla'}
          </Button>
        </SettingsRow>
      </SettingsGroup>

      <SettingsGroup title="Plantillas">
        {templates.length === 0 && <SettingsEmpty>Todavía no has creado ninguna</SettingsEmpty>}
        {templates.map((t) => (
          <SettingsRow key={t.id} label={t.name} hint={t.subject || t.body.slice(0, 90)}>
            <div className="flex items-center gap-3">
              <span className="bg-chip-blue text-chip-blue-fg rounded-full px-2 py-0.5 text-xs font-medium">
                {channelLabel(t.channel)}
              </span>
              <Button
                variant="ghost"
                size="sm"
                onClick={() => remove(t.id, t.name)}
                aria-label={`Borrar ${t.name}`}
                className="hover:text-danger"
              >
                <Trash2 size={14} />
              </Button>
            </div>
          </SettingsRow>
        ))}
      </SettingsGroup>
    </div>
  );
}

export default TemplatesPanel;
