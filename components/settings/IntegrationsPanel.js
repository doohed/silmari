'use client';

import { useState } from 'react';
import { toast } from 'sonner';
import { Mail, MessageCircle, CheckCircle2 } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Label } from '@/components/ui/Label';
import { useConfirm } from '@/components/ui/ConfirmDialog';
import {
  saveEmailConnectionAction,
  deleteEmailConnectionAction,
  saveWhatsappConnectionAction,
  deleteWhatsappConnectionAction,
} from '@/app/(workspace)/settings/integrations/actions';

function ConnectedBadge() {
  return (
    <span className="text-success flex items-center gap-1 text-xs font-medium">
      <CheckCircle2 size={13} /> Conectado
    </span>
  );
}

function EmailCard({ initial }) {
  const confirm = useConfirm();
  const [connected, setConnected] = useState(initial.connected);
  const [host, setHost] = useState(initial.host || 'smtp.gmail.com');
  const [port, setPort] = useState(initial.port || 587);
  const [secure, setSecure] = useState(initial.secure ?? false);
  const [user, setUser] = useState(initial.user || '');
  const [fromName, setFromName] = useState(initial.fromName || '');
  const [fromEmail, setFromEmail] = useState(initial.fromEmail || '');
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);

  async function save(e) {
    e.preventDefault();
    setBusy(true);
    const r = await saveEmailConnectionAction({
      host,
      port,
      secure,
      user,
      fromName,
      fromEmail,
      password: password || undefined,
    });
    setBusy(false);
    if (!r.ok) return toast.error(r.message);
    setConnected(true);
    setPassword('');
    toast.success('Cuenta de correo guardada');
  }

  async function disconnect() {
    const ok = await confirm({
      title: 'Desconectar correo',
      message: 'Dejarás de poder enviar emails hasta que vuelvas a conectar una cuenta.',
      confirmLabel: 'Desconectar',
      danger: true,
    });
    if (!ok) return;
    const r = await deleteEmailConnectionAction();
    if (r.ok) {
      setConnected(false);
      setPassword('');
      toast.success('Correo desconectado');
    }
  }

  return (
    <form onSubmit={save} className="border-border bg-surface space-y-3 rounded-lg border p-4">
      <div className="flex items-center justify-between">
        <div className="text-primary flex items-center gap-2 text-sm font-medium">
          <Mail size={16} /> Correo (SMTP)
        </div>
        {connected && <ConnectedBadge />}
      </div>

      <div className="grid grid-cols-3 gap-3">
        <div className="col-span-2">
          <Label htmlFor="smtp-host">Servidor SMTP</Label>
          <Input id="smtp-host" value={host} onChange={(e) => setHost(e.target.value)} />
        </div>
        <div>
          <Label htmlFor="smtp-port">Puerto</Label>
          <Input
            id="smtp-port"
            type="number"
            value={port}
            onChange={(e) => setPort(Number(e.target.value))}
          />
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div>
          <Label htmlFor="smtp-user">Usuario</Label>
          <Input
            id="smtp-user"
            value={user}
            onChange={(e) => setUser(e.target.value)}
            placeholder="tu@gmail.com"
          />
        </div>
        <div>
          <Label htmlFor="smtp-pass">Contraseña {connected && '(sin cambios)'}</Label>
          <Input
            id="smtp-pass"
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder={connected ? '••••••••' : 'contraseña de aplicación'}
          />
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <div>
          <Label htmlFor="smtp-fromname">Nombre del remitente</Label>
          <Input
            id="smtp-fromname"
            value={fromName}
            onChange={(e) => setFromName(e.target.value)}
            placeholder="Tu empresa"
          />
        </div>
        <div>
          <Label htmlFor="smtp-fromemail">Correo del remitente</Label>
          <Input
            id="smtp-fromemail"
            value={fromEmail}
            onChange={(e) => setFromEmail(e.target.value)}
            placeholder="(por defecto, el usuario)"
          />
        </div>
      </div>

      <label className="text-secondary flex items-center gap-2 text-xs">
        <input type="checkbox" checked={secure} onChange={(e) => setSecure(e.target.checked)} />
        Conexión segura (SSL/TLS directo, puerto 465)
      </label>

      <p className="text-tertiary text-xs">
        Con Gmail: activa la verificación en dos pasos y genera una{' '}
        <span className="text-secondary">contraseña de aplicación</span> (host{' '}
        <span className="font-mono">smtp.gmail.com</span>, puerto 587).
      </p>

      <div className="flex gap-2">
        <Button size="sm" type="submit" disabled={busy}>
          {busy ? 'Guardando…' : connected ? 'Actualizar' : 'Conectar'}
        </Button>
        {connected && (
          <Button size="sm" variant="ghost" type="button" onClick={disconnect}>
            Desconectar
          </Button>
        )}
      </div>
    </form>
  );
}

function WhatsappCard({ initial }) {
  const confirm = useConfirm();
  const [connected, setConnected] = useState(initial.connected);
  const [phoneNumberId, setPhoneNumberId] = useState(initial.phoneNumberId || '');
  const [businessId, setBusinessId] = useState(initial.businessId || '');
  const [accessToken, setAccessToken] = useState('');
  const [busy, setBusy] = useState(false);

  async function save(e) {
    e.preventDefault();
    setBusy(true);
    const r = await saveWhatsappConnectionAction({
      phoneNumberId,
      businessId,
      accessToken: accessToken || undefined,
    });
    setBusy(false);
    if (!r.ok) return toast.error(r.message);
    setConnected(true);
    setAccessToken('');
    toast.success('WhatsApp guardado');
  }

  async function disconnect() {
    const ok = await confirm({
      title: 'Desconectar WhatsApp',
      message: 'Dejarás de poder enviar mensajes hasta que vuelvas a conectar un número.',
      confirmLabel: 'Desconectar',
      danger: true,
    });
    if (!ok) return;
    const r = await deleteWhatsappConnectionAction();
    if (r.ok) {
      setConnected(false);
      setAccessToken('');
      toast.success('WhatsApp desconectado');
    }
  }

  return (
    <form onSubmit={save} className="border-border bg-surface space-y-3 rounded-lg border p-4">
      <div className="flex items-center justify-between">
        <div className="text-primary flex items-center gap-2 text-sm font-medium">
          <MessageCircle size={16} /> WhatsApp (Cloud API de Meta)
        </div>
        {connected && <ConnectedBadge />}
      </div>

      <div>
        <Label htmlFor="wa-phone">ID del número (phone_number_id)</Label>
        <Input
          id="wa-phone"
          value={phoneNumberId}
          onChange={(e) => setPhoneNumberId(e.target.value)}
          placeholder="1234567890"
        />
      </div>
      <div>
        <Label htmlFor="wa-token">Token de acceso {connected && '(sin cambios)'}</Label>
        <Input
          id="wa-token"
          type="password"
          value={accessToken}
          onChange={(e) => setAccessToken(e.target.value)}
          placeholder={connected ? '••••••••' : 'EAAG...'}
        />
      </div>
      <div>
        <Label htmlFor="wa-biz">ID de la cuenta de empresa (opcional)</Label>
        <Input id="wa-biz" value={businessId} onChange={(e) => setBusinessId(e.target.value)} />
      </div>

      <p className="text-tertiary text-xs">
        En Meta for Developers: crea una app, añade el producto WhatsApp y copia el{' '}
        <span className="font-mono">phone_number_id</span> y un token de acceso. Tienes un número de
        prueba gratis.
      </p>

      <div className="flex gap-2">
        <Button size="sm" type="submit" disabled={busy}>
          {busy ? 'Guardando…' : connected ? 'Actualizar' : 'Conectar'}
        </Button>
        {connected && (
          <Button size="sm" variant="ghost" type="button" onClick={disconnect}>
            Desconectar
          </Button>
        )}
      </div>
    </form>
  );
}

export function IntegrationsPanel({ email, whatsapp }) {
  return (
    <div className="space-y-6">
      <EmailCard initial={email} />
      <WhatsappCard initial={whatsapp} />
    </div>
  );
}

export default IntegrationsPanel;
