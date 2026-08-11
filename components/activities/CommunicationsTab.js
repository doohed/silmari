'use client';

import { useEffect, useMemo, useState } from 'react';
import { toast } from 'sonner';
import { Mail, MessageCircle, Send, ArrowUpRight, ArrowDownLeft, Plus, Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Label } from '@/components/ui/Label';
import { Select } from '@/components/ui/Select';
import { formatRelative } from '@/lib/utils/relative-time';
import {
  listCommunicationsAction,
  logCommunicationAction,
  sendEmailAction,
  sendWhatsappAction,
  listComposeTemplatesAction,
  renderTemplateAction,
  deleteActivityAction,
} from '@/app/(workspace)/objects/actions';

const TEXTAREA =
  'bg-surface text-primary placeholder:text-tertiary border-border focus:border-accent focus:ring-accent/15 min-h-24 w-full rounded-md border px-3 py-2 text-[13px] focus:ring-2 focus:outline-none';

const CHANNELS = [
  { value: 'EMAIL', label: 'Email' },
  { value: 'WHATSAPP', label: 'WhatsApp' },
];
const DIRECTIONS = [
  { value: 'OUTBOUND', label: 'Enviado' },
  { value: 'INBOUND', label: 'Recibido' },
];

function ChannelIcon({ channel, size = 14 }) {
  return channel === 'WHATSAPP' ? <MessageCircle size={size} /> : <Mail size={size} />;
}

export function CommunicationsTab({ object, recordId }) {
  const [comms, setComms] = useState([]);
  const [templates, setTemplates] = useState([]);
  const [open, setOpen] = useState(false);
  const [channel, setChannel] = useState('EMAIL');
  const [direction, setDirection] = useState('OUTBOUND');
  const [templateId, setTemplateId] = useState('');
  const [contact, setContact] = useState('');
  const [subject, setSubject] = useState('');
  const [body, setBody] = useState('');
  const [busy, setBusy] = useState(false);

  async function refresh() {
    const r = await listCommunicationsAction({ recordId });
    if (r.ok) setComms(r.data);
  }

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    refresh();
    listComposeTemplatesAction({}).then((r) => r.ok && setTemplates(r.data));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [recordId]);

  const channelTemplates = useMemo(
    () => templates.filter((t) => t.channel === channel),
    [templates, channel],
  );
  const targets = [{ objectMetadataId: object.id, recordId }];

  async function applyTemplate(id) {
    setTemplateId(id);
    if (!id) return;
    const r = await renderTemplateAction({ templateId: id, objectSlug: object.slug, recordId });
    if (r.ok) {
      setSubject(r.data.subject);
      setBody(r.data.body);
    } else {
      toast.error(r.message);
    }
  }

  function resetForm() {
    setTemplateId('');
    setContact('');
    setSubject('');
    setBody('');
    setOpen(false);
  }

  /** Enviar de verdad por el proveedor (avisa si no hay cuenta conectada). */
  async function send() {
    if (!body.trim()) return toast.error('Escribe un mensaje');
    setBusy(true);
    const action = channel === 'EMAIL' ? sendEmailAction : sendWhatsappAction;
    const input =
      channel === 'EMAIL' ? { to: contact, subject, body, targets } : { to: contact, body, targets };
    const r = await action(input);
    setBusy(false);
    if (!r.ok) return toast.error(r.message);
    resetForm();
    refresh();
    toast.success('Mensaje enviado');
  }

  /** Registrar en la ficha sin enviar (recibido, o enviado por fuera). */
  async function logOnly() {
    if (!body.trim()) return toast.error('Escribe un mensaje');
    setBusy(true);
    const input = {
      channel,
      direction,
      subject: channel === 'EMAIL' ? subject : '',
      body,
      targets,
      ...(direction === 'OUTBOUND' ? { to: contact } : { from: contact }),
    };
    const r = await logCommunicationAction(input);
    setBusy(false);
    if (!r.ok) return toast.error(r.message);
    resetForm();
    refresh();
    toast.success('Comunicación registrada');
  }

  async function remove(id) {
    const r = await deleteActivityAction({ id });
    if (r.ok) refresh();
  }

  return (
    <div className="space-y-4 p-6">
      {!open ? (
        <Button size="sm" onClick={() => setOpen(true)}>
          <Plus size={14} /> Nueva comunicación
        </Button>
      ) : (
        <div className="border-border bg-bg space-y-3 rounded-lg border p-3">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label>Canal</Label>
              <Select
                value={channel}
                onChange={(v) => {
                  setChannel(v);
                  setTemplateId('');
                }}
                options={CHANNELS}
              />
            </div>
            <div>
              <Label>Dirección</Label>
              <Select value={direction} onChange={setDirection} options={DIRECTIONS} />
            </div>
          </div>

          {direction === 'OUTBOUND' && channelTemplates.length > 0 && (
            <div>
              <Label>Plantilla</Label>
              <Select
                value={templateId}
                onChange={applyTemplate}
                options={[
                  { value: '', label: 'Sin plantilla' },
                  ...channelTemplates.map((t) => ({ value: t.id, label: t.name })),
                ]}
              />
            </div>
          )}

          <div>
            <Label>{direction === 'OUTBOUND' ? 'Para' : 'De'}</Label>
            <Input
              value={contact}
              onChange={(e) => setContact(e.target.value)}
              placeholder={channel === 'EMAIL' ? 'correo@ejemplo.com' : '+34 600 000 000'}
            />
          </div>

          {channel === 'EMAIL' && (
            <div>
              <Label>Asunto</Label>
              <Input value={subject} onChange={(e) => setSubject(e.target.value)} />
            </div>
          )}

          <div>
            <Label>Mensaje</Label>
            <textarea
              value={body}
              onChange={(e) => setBody(e.target.value)}
              placeholder="Escribe el mensaje…"
              className={TEXTAREA}
            />
          </div>

          <div className="flex flex-wrap gap-2">
            {direction === 'OUTBOUND' && (
              <Button size="sm" onClick={send} disabled={busy}>
                <Send size={13} /> Enviar
              </Button>
            )}
            <Button size="sm" variant={direction === 'OUTBOUND' ? 'ghost' : 'primary'} onClick={logOnly} disabled={busy}>
              {direction === 'OUTBOUND' ? 'Registrar sin enviar' : 'Registrar'}
            </Button>
            <Button size="sm" variant="ghost" onClick={resetForm} disabled={busy}>
              Cancelar
            </Button>
          </div>
          {direction === 'OUTBOUND' && (
            <p className="text-tertiary text-xs">
              El envío necesita una cuenta conectada (Gmail/Outlook o WhatsApp). Mientras tanto,
              «Registrar sin enviar» guarda la comunicación en la ficha.
            </p>
          )}
        </div>
      )}

      <ul className="space-y-2.5">
        {comms.length === 0 && <li className="text-tertiary text-sm">Sin comunicaciones todavía</li>}
        {comms.map((c) => (
          <li key={c.id} className="border-border bg-surface rounded-lg border p-3">
            <div className="flex items-start justify-between gap-2">
              <div className="min-w-0">
                <div className="text-secondary flex items-center gap-1.5 text-xs">
                  <ChannelIcon channel={c.comm?.channel} />
                  {c.comm?.direction === 'INBOUND' ? (
                    <ArrowDownLeft size={12} className="text-success" />
                  ) : (
                    <ArrowUpRight size={12} className="text-accent" />
                  )}
                  <span className="truncate">
                    {c.comm?.direction === 'INBOUND'
                      ? `De ${c.comm?.from || '—'}`
                      : `Para ${(c.comm?.to ?? []).join(', ') || '—'}`}
                  </span>
                  <span className="text-tertiary">· {formatRelative(c.createdAt)}</span>
                </div>
                {c.title && <p className="text-primary mt-1 text-sm font-medium">{c.title}</p>}
                {c.body && (
                  <p className="text-secondary mt-0.5 text-sm whitespace-pre-wrap">{c.body}</p>
                )}
              </div>
              <button
                type="button"
                onClick={() => remove(c.id)}
                className="text-tertiary hover:text-danger shrink-0"
                aria-label="Eliminar comunicación"
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

export default CommunicationsTab;
