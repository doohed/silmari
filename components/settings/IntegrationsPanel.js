'use client';

import { useState } from 'react';
import { toast } from 'sonner';
import { CheckCircle2 } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { SettingsGroup, SettingsRow } from '@/components/ui/SettingsGroup';
import { useConfirm } from '@/components/ui/ConfirmDialog';
import {
  saveEmailConnectionAction,
  deleteEmailConnectionAction,
  saveWhatsappConnectionAction,
  deleteWhatsappConnectionAction,
} from '@/app/(workspace)/settings/integrations/actions';

/**
 * Integraciones salientes (SMTP y WhatsApp), en listas agrupadas.
 *
 * Antes era un formulario clásico —etiqueta encima, campo debajo, en rejilla de
 * dos y tres columnas— dentro de una tarjeta con su propio encabezado. Ahora
 * cada conexión es **un grupo**, con el nombre del servicio de título y una fila
 * por dato. Es más largo en vertical y se lee mucho mejor: cada línea es "esto
 * se llama así y vale esto", que es lo que hace una pantalla de ajustes.
 *
 * El estado (conectado o no) va en la primera fila del grupo, no en un badge
 * flotando en la esquina.
 */

/** Chip de estado de una conexión. */
function StatusChip({ connected }) {
  return connected ? (
    <span className="text-success flex items-center gap-1 text-[13px] font-medium">
      <CheckCircle2 size={14} aria-hidden /> Conectado
    </span>
  ) : (
    <span className="bg-chip-gray text-chip-gray-fg rounded-full px-2 py-0.5 text-xs">
      Sin conectar
    </span>
  );
}

/** Fila con los botones de guardar y desconectar. */
function ActionsRow({ connected, busy, onDisconnect }) {
  return (
    <SettingsRow label={connected ? 'Actualizar la conexión' : 'Guardar y conectar'}>
      <div className="flex gap-2">
        {connected && (
          <Button size="md" variant="ghost" type="button" onClick={onDisconnect}>
            Desconectar
          </Button>
        )}
        <Button size="md" type="submit" disabled={busy}>
          {busy ? 'Guardando…' : connected ? 'Actualizar' : 'Conectar'}
        </Button>
      </div>
    </SettingsRow>
  );
}

function EmailGroup({ initial }) {
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
    <form onSubmit={save}>
      <SettingsGroup
        title="Correo (SMTP)"
        footnote="Con Gmail: activa la verificación en dos pasos y genera una contraseña de aplicación (host smtp.gmail.com, puerto 587). La contraseña se guarda cifrada."
      >
        <SettingsRow label="Estado">
          <StatusChip connected={connected} />
        </SettingsRow>
        <SettingsRow label="Servidor">
          <Input
            aria-label="Servidor SMTP"
            value={host}
            onChange={(e) => setHost(e.target.value)}
            className="w-56"
          />
        </SettingsRow>
        <SettingsRow label="Puerto">
          <Input
            aria-label="Puerto"
            type="number"
            value={port}
            onChange={(e) => setPort(Number(e.target.value))}
            className="w-24"
          />
        </SettingsRow>
        <SettingsRow label="Conexión segura" hint="SSL/TLS directo, para el puerto 465">
          {/* El checkbox propio (`appearance:none` en globals.css) no tiene
              tamaño intrínseco: sin una clase `size-*` se queda en un punto. */}
          <input
            type="checkbox"
            className="size-4"
            checked={secure}
            onChange={(e) => setSecure(e.target.checked)}
            aria-label="Conexión segura"
          />
        </SettingsRow>
        <SettingsRow label="Usuario">
          <Input
            aria-label="Usuario"
            value={user}
            onChange={(e) => setUser(e.target.value)}
            placeholder="tu@gmail.com"
            className="w-56"
          />
        </SettingsRow>
        <SettingsRow
          label="Contraseña"
          hint={connected ? 'Déjala vacía para no cambiarla' : undefined}
        >
          <Input
            aria-label="Contraseña"
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder={connected ? '••••••••' : 'contraseña de aplicación'}
            className="w-56"
          />
        </SettingsRow>
        <SettingsRow label="Nombre del remitente">
          <Input
            aria-label="Nombre del remitente"
            value={fromName}
            onChange={(e) => setFromName(e.target.value)}
            placeholder="Tu empresa"
            className="w-56"
          />
        </SettingsRow>
        <SettingsRow label="Correo del remitente">
          <Input
            aria-label="Correo del remitente"
            value={fromEmail}
            onChange={(e) => setFromEmail(e.target.value)}
            placeholder="(por defecto, el usuario)"
            className="w-56"
          />
        </SettingsRow>
        <ActionsRow connected={connected} busy={busy} onDisconnect={disconnect} />
      </SettingsGroup>
    </form>
  );
}

function WhatsappGroup({ initial }) {
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
    <form onSubmit={save}>
      <SettingsGroup
        title="WhatsApp (Cloud API de Meta)"
        footnote="En Meta for Developers: crea una app, añade el producto WhatsApp y copia el phone_number_id y un token de acceso. Tienes un número de prueba gratis. El token se guarda cifrado."
      >
        <SettingsRow label="Estado">
          <StatusChip connected={connected} />
        </SettingsRow>
        <SettingsRow label="ID del número" hint="phone_number_id">
          <Input
            aria-label="ID del número"
            value={phoneNumberId}
            onChange={(e) => setPhoneNumberId(e.target.value)}
            placeholder="1234567890"
            className="w-56"
          />
        </SettingsRow>
        <SettingsRow
          label="Token de acceso"
          hint={connected ? 'Déjalo vacío para no cambiarlo' : undefined}
        >
          <Input
            aria-label="Token de acceso"
            type="password"
            value={accessToken}
            onChange={(e) => setAccessToken(e.target.value)}
            placeholder={connected ? '••••••••' : 'EAAG…'}
            className="w-56"
          />
        </SettingsRow>
        <SettingsRow label="ID de la cuenta de empresa" hint="Opcional">
          <Input
            aria-label="ID de la cuenta de empresa"
            value={businessId}
            onChange={(e) => setBusinessId(e.target.value)}
            className="w-56"
          />
        </SettingsRow>
        <ActionsRow connected={connected} busy={busy} onDisconnect={disconnect} />
      </SettingsGroup>
    </form>
  );
}

export function IntegrationsPanel({ email, whatsapp }) {
  return (
    <div>
      <EmailGroup initial={email} />
      <WhatsappGroup initial={whatsapp} />
    </div>
  );
}

export default IntegrationsPanel;
