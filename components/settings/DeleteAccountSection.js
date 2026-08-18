'use client';

import { useState, useTransition } from 'react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { deleteAccountAction } from '@/app/(workspace)/settings/actions';

const CONFIRM_WORD = 'ELIMINAR';

/** Zona de peligro: eliminar la cuenta con confirmación por texto. */
export function DeleteAccountSection() {
  const [open, setOpen] = useState(false);
  const [text, setText] = useState('');
  const [pending, startTransition] = useTransition();

  function confirmDelete() {
    startTransition(async () => {
      // La acción borra, cierra sesión y redirige; solo vuelve si hay error.
      const r = await deleteAccountAction();
      if (r?.ok === false) toast.error(r.message || 'No se pudo eliminar la cuenta');
    });
  }

  return (
    <>
      <Button variant="danger" size="sm" onClick={() => setOpen(true)}>
        Eliminar…
      </Button>

      {open && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div
            className="anim-overlay absolute inset-0 bg-black/40"
            onClick={() => !pending && setOpen(false)}
          />
          <div className="anim-dialog mac-menu relative w-full max-w-md rounded-2xl border p-6 shadow-lg">
            <h2 className="text-primary text-base font-semibold">Eliminar cuenta</h2>
            <p className="text-secondary mt-2 text-sm">
              Esta acción es irreversible: perderás el acceso y tu cuenta quedará eliminada. Escribe{' '}
              <span className="text-primary font-semibold">{CONFIRM_WORD}</span> para confirmar.
            </p>
            <Input
              autoFocus
              value={text}
              onChange={(e) => setText(e.target.value)}
              placeholder={CONFIRM_WORD}
              className="mt-4"
            />
            <div className="mt-5 flex justify-end gap-2">
              <Button variant="ghost" size="sm" onClick={() => setOpen(false)} disabled={pending}>
                Cancelar
              </Button>
              <Button
                variant="danger"
                size="sm"
                onClick={confirmDelete}
                disabled={pending || text !== CONFIRM_WORD}
              >
                {pending ? 'Eliminando…' : 'Eliminar definitivamente'}
              </Button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}

export default DeleteAccountSection;
