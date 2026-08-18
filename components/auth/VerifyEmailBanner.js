'use client';

import { useState } from 'react';
import { toast } from 'sonner';
import { MailWarning } from 'lucide-react';
import { resendVerificationAction } from '@/app/(workspace)/actions';

/**
 * Aviso persistente mientras la cuenta no ha confirmado su dirección. No es un
 * muro: la app se sigue usando, solo quedan bloqueadas invitar, las API keys y
 * los webhooks (ver `assertEmailVerified`).
 *
 * @param {{ email: string }} props
 */
export function VerifyEmailBanner({ email }) {
  const [sending, setSending] = useState(false);
  const [sent, setSent] = useState(false);

  async function resend() {
    setSending(true);
    const result = await resendVerificationAction();
    setSending(false);
    if (result?.ok === false) {
      toast.error(result.message);
      return;
    }
    setSent(true);
    toast.success('Te hemos reenviado el correo');
  }

  return (
    <div className="border-border bg-chip-yellow flex items-center gap-3 border-b px-4 py-2 text-xs">
      <MailWarning size={15} className="text-secondary shrink-0" />
      <p className="text-primary min-w-0 flex-1">
        Confirma tu email <span className="font-medium">{email}</span> para poder invitar a tu
        equipo y crear API keys.
      </p>
      <button
        type="button"
        onClick={resend}
        disabled={sending || sent}
        className="text-accent shrink-0 font-medium disabled:opacity-60"
      >
        {sent ? 'Enviado' : sending ? 'Enviando…' : 'Reenviar correo'}
      </button>
    </div>
  );
}

export default VerifyEmailBanner;
