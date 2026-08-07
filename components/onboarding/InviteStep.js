'use client';

import { useState, useTransition } from 'react';
import { X, Link2 } from 'lucide-react';
import { toast } from 'sonner';
import { saveInviteAction, skipInviteAction, createInviteLinkAction } from '@/app/onboarding/actions';
import { StepFrame } from './StepFrame';
import { Button } from '@/components/ui/Button';

const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const PLACEHOLDERS = ['ana@empresa.com', 'luis@empresa.com', 'sara@empresa.com'];

/** Paso 3 del onboarding: invitar hasta 3 personas por email o enlace. */
export function InviteStep() {
  const [emails, setEmails] = useState(['', '', '']);
  const [pending, startTransition] = useTransition();
  const [copying, setCopying] = useState(-1);

  const setAt = (i, v) => setEmails((prev) => prev.map((e, idx) => (idx === i ? v : e)));
  const filled = emails.map((e) => e.trim()).filter(Boolean);
  const allValid = filled.every((e) => EMAIL_RE.test(e));

  function invite() {
    if (filled.length && !allValid) {
      toast.error('Revisa los emails: alguno no es válido');
      return;
    }
    startTransition(async () => {
      const r = await saveInviteAction({ emails: filled });
      if (r?.ok === false) toast.error(r.message || 'No se pudieron enviar las invitaciones');
    });
  }

  function skip() {
    startTransition(async () => {
      const r = await skipInviteAction();
      if (r?.ok === false) toast.error(r.message);
    });
  }

  async function copyLink(i) {
    const email = emails[i].trim();
    if (!EMAIL_RE.test(email)) {
      toast.error('Escribe un email válido para generar el enlace');
      return;
    }
    setCopying(i);
    try {
      const r = await createInviteLinkAction({ email });
      if (r?.ok === false) {
        toast.error(r.message || 'No se pudo generar el enlace');
        return;
      }
      await navigator.clipboard.writeText(r.url);
      toast.success('Enlace de invitación copiado');
    } catch {
      toast.error('No se pudo copiar el enlace');
    } finally {
      setCopying(-1);
    }
  }

  return (
    <StepFrame
      title="Invita a tu equipo"
      subtitle="Saca el máximo partido invitando a tus compañeros"
    >
      <div className="space-y-3">
        {emails.map((value, i) => (
          <div
            key={i}
            className="focus-within:border-accent border-border bg-surface flex h-10 items-center rounded-lg border pr-2 transition-[border-color]"
          >
            <input
              type="email"
              value={value}
              onChange={(e) => setAt(i, e.target.value)}
              placeholder={PLACEHOLDERS[i]}
              autoComplete="off"
              className="text-primary placeholder:text-tertiary h-full min-w-0 flex-1 rounded-lg bg-transparent px-3.5 text-sm outline-none"
            />
            {EMAIL_RE.test(value.trim()) && (
              <button
                type="button"
                onClick={() => copyLink(i)}
                disabled={copying === i}
                className="press text-tertiary hover:text-accent mr-1 flex items-center gap-1 rounded-md px-1.5 py-1 text-xs"
                title="Copiar enlace de invitación"
              >
                <Link2 size={13} /> {copying === i ? 'Copiando…' : 'Enlace'}
              </button>
            )}
            {value && (
              <button
                type="button"
                onClick={() => setAt(i, '')}
                className="press text-tertiary hover:text-primary"
                aria-label="Borrar"
              >
                <X size={15} />
              </button>
            )}
          </div>
        ))}
      </div>

      <div className="mt-8 space-y-3">
        <Button type="button" onClick={invite} disabled={pending} className="w-full">
          {pending ? 'Enviando…' : filled.length ? 'Invitar' : 'Continuar'}
        </Button>
        <button
          type="button"
          onClick={skip}
          disabled={pending}
          className="press text-tertiary hover:text-secondary mx-auto block text-sm"
        >
          Saltar
        </button>
      </div>
    </StepFrame>
  );
}

export default InviteStep;
