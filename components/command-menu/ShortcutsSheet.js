'use client';

import * as Dialog from '@radix-ui/react-dialog';

const SHORTCUTS = [
  ['⌘ K', 'Abrir el menú de comandos'],
  ['/', 'Buscar registros'],
  ['C', 'Crear un registro'],
  ['G luego H', 'Ir al inicio'],
  ['G luego T', 'Ir a Tareas'],
  ['G luego S', 'Ir a Ajustes'],
  ['⌘ /', 'Mostrar esta hoja de atajos'],
  ['Esc', 'Cerrar'],
];

export function ShortcutsSheet({ open, onOpenChange }) {
  return (
    <Dialog.Root open={open} onOpenChange={onOpenChange}>
      <Dialog.Portal>
        <Dialog.Overlay className="anim-overlay fixed inset-0 z-50 bg-black/40" />
        <Dialog.Content className="anim-dialog mac-menu fixed top-1/2 left-1/2 z-50 w-[92%] max-w-md -translate-x-1/2 -translate-y-1/2 rounded-lg border p-5 shadow-xl">
          <Dialog.Title className="text-primary mb-3 text-sm font-semibold">
            Atajos de teclado
          </Dialog.Title>
          <Dialog.Description className="sr-only">Lista de atajos de teclado</Dialog.Description>
          <ul className="space-y-1.5">
            {SHORTCUTS.map(([keys, desc]) => (
              <li key={keys} className="flex items-center justify-between text-sm">
                <span className="text-secondary">{desc}</span>
                <kbd className="border-border bg-surface text-primary rounded border px-1.5 py-0.5 font-mono text-xs">
                  {keys}
                </kbd>
              </li>
            ))}
          </ul>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}

export default ShortcutsSheet;
