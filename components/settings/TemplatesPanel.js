'use client';

import { useMemo, useRef, useState } from 'react';
import { toast } from 'sonner';
import { Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Label } from '@/components/ui/Label';
import { Select } from '@/components/ui/Select';
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
    <div className="space-y-6">
      <form onSubmit={create} className="border-border bg-bg space-y-4 rounded-lg border p-4">
        <div className="grid grid-cols-2 gap-3">
          <div>
            <Label htmlFor="tpl-name">Nombre</Label>
            <Input
              id="tpl-name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="p. ej. Bienvenida"
            />
          </div>
          <div>
            <Label>Canal</Label>
            <Select value={channel} onChange={setChannel} options={CHANNELS} />
          </div>
        </div>

        <div>
          <Label>Objeto (opcional)</Label>
          <Select
            value={objectSlug}
            onChange={setObjectSlug}
            options={[
              { value: '', label: 'Sin objeto' },
              ...objects.map((o) => ({ value: o.slug, label: o.labelSingular })),
            ]}
          />
        </div>

        {channel === 'EMAIL' && (
          <div>
            <Label htmlFor="tpl-subject">Asunto</Label>
            <Input
              id="tpl-subject"
              value={subject}
              onChange={(e) => setSubject(e.target.value)}
              placeholder="Hola {{name}}"
            />
          </div>
        )}

        <div>
          <Label htmlFor="tpl-body">Mensaje</Label>
          <textarea
            id="tpl-body"
            ref={bodyRef}
            value={body}
            onChange={(e) => setBody(e.target.value)}
            placeholder="Hola {{name}}, gracias por tu interés…"
            className={TEXTAREA}
          />
          {fields.length > 0 && (
            <div className="mt-2">
              <span className="text-tertiary mb-1 block text-xs">Insertar variable</span>
              <div className="flex flex-wrap gap-1.5">
                {fields.map((f) => (
                  <button
                    key={f.name}
                    type="button"
                    onClick={() => insertVariable(f.name)}
                    className="border-border text-secondary hover:border-accent hover:text-primary rounded-md border px-2 py-0.5 font-mono text-xs"
                  >
                    {`{{${f.name}}}`}
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Vista previa */}
        {(subject || body) && (
          <div className="border-border bg-surface rounded-md border p-3">
            <span className="text-tertiary mb-1 block text-xs">Vista previa</span>
            {channel === 'EMAIL' && subject && (
              <p className="text-primary mb-1 text-sm font-medium">
                {renderTemplate(subject, previewVars)}
              </p>
            )}
            <p className="text-secondary text-sm whitespace-pre-wrap">
              {renderTemplate(body, previewVars)}
            </p>
          </div>
        )}

        <Button size="sm" type="submit" disabled={saving || !name.trim() || !body.trim()}>
          {saving ? 'Creando…' : 'Crear plantilla'}
        </Button>
      </form>

      <ul className="space-y-3">
        {templates.length === 0 && <li className="text-tertiary text-sm">Sin plantillas</li>}
        {templates.map((t) => (
          <li key={t.id} className="border-border bg-surface rounded-lg border p-3">
            <div className="flex items-start justify-between gap-2">
              <div className="min-w-0">
                <div className="flex items-center gap-2">
                  <p className="text-primary truncate text-sm font-medium">{t.name}</p>
                  <span className="bg-chip-blue text-chip-blue-fg rounded px-1.5 py-0.5 text-[10px] font-medium">
                    {channelLabel(t.channel)}
                  </span>
                </div>
                {t.subject && <p className="text-secondary mt-0.5 truncate text-xs">{t.subject}</p>}
                <p className="text-tertiary mt-0.5 line-clamp-2 text-xs">{t.body}</p>
              </div>
              <button
                type="button"
                onClick={() => remove(t.id, t.name)}
                className="text-tertiary hover:text-danger shrink-0"
                aria-label="Borrar plantilla"
              >
                <Trash2 size={14} />
              </button>
            </div>
          </li>
        ))}
      </ul>
    </div>
  );
}

export default TemplatesPanel;
