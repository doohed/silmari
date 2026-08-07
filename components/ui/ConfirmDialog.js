'use client';

import { createContext, useCallback, useContext, useRef, useState } from 'react';
import * as Dialog from '@radix-ui/react-dialog';
import { Button } from '@/components/ui/Button';

const ConfirmContext = createContext(null);

/**
 * Proveedor de confirmaciones con el tema de la app (sustituye a `window.confirm`).
 * Expón `useConfirm()` para obtener `confirm(opts) => Promise<boolean>`.
 */
export function ConfirmProvider({ children }) {
  const [state, setState] = useState({ open: false, opts: {} });
  const resolver = useRef(null);

  const confirm = useCallback(
    (opts = {}) =>
      new Promise((resolve) => {
        resolver.current = resolve;
        setState({ open: true, opts });
      }),
    [],
  );

  const settle = (result) => {
    setState((s) => ({ ...s, open: false }));
    resolver.current?.(result);
    resolver.current = null;
  };

  const { open, opts } = state;
  const {
    title,
    message,
    confirmLabel = 'Confirmar',
    cancelLabel = 'Cancelar',
    danger = false,
  } = opts;

  return (
    <ConfirmContext.Provider value={confirm}>
      {children}
      <Dialog.Root
        open={open}
        onOpenChange={(o) => {
          if (!o) settle(false);
        }}
      >
        <Dialog.Portal>
          <Dialog.Overlay className="anim-overlay fixed inset-0 z-50 bg-black/40" />
          <Dialog.Content className="anim-dialog border-border bg-elevated fixed top-1/2 left-1/2 z-50 w-[92%] max-w-sm -translate-x-1/2 -translate-y-1/2 rounded-lg border p-5 shadow-lg">
            <Dialog.Title
              className={title ? 'text-primary mb-1 text-sm font-semibold' : 'sr-only'}
            >
              {title ?? 'Confirmar'}
            </Dialog.Title>
            <Dialog.Description className="text-secondary text-sm">{message}</Dialog.Description>
            <div className="mt-5 flex justify-end gap-2">
              <Button size="sm" variant="secondary" onClick={() => settle(false)}>
                {cancelLabel}
              </Button>
              <Button
                size="sm"
                variant={danger ? 'danger' : 'primary'}
                onClick={() => settle(true)}
              >
                {confirmLabel}
              </Button>
            </div>
          </Dialog.Content>
        </Dialog.Portal>
      </Dialog.Root>
    </ConfirmContext.Provider>
  );
}

/** Devuelve `confirm(opts) => Promise<boolean>`. Requiere `<ConfirmProvider>`. */
export function useConfirm() {
  const ctx = useContext(ConfirmContext);
  if (!ctx) throw new Error('useConfirm debe usarse dentro de <ConfirmProvider>');
  return ctx;
}

export default ConfirmProvider;
