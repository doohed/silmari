'use client';

import { useEffect, useState } from 'react';
import { usePathname } from 'next/navigation';
import { Menu, X } from 'lucide-react';
import { useResizableWidth } from '@/hooks/useResizableWidth';
import { ResizeHandle } from '@/components/ui/ResizeHandle';

/**
 * Contenedor del rail de navegación, con dos comportamientos según el ancho.
 *
 * - **Escritorio (md+)**: columna fija redimensionable por arrastre, como
 *   siempre.
 * - **Móvil**: barra superior con un botón de menú y un cajón que entra desde la
 *   izquierda. Un rail fijo de 224 px dejaría 150 px de contenido en un teléfono.
 *
 * El contenido del rail es el mismo en ambos casos: llega como `children` desde
 * el layout (Server Component), así que no se duplica nada.
 */
export function SidebarShell({ children, workspaceName }) {
  const [open, setOpen] = useState(false);
  const pathname = usePathname();
  const [lastPath, setLastPath] = useState(pathname);

  // Navegar cierra el cajón: si no, al tocar un objeto del menú te quedas
  // mirando el propio menú encima de la página que acabas de abrir.
  //
  // Va como ajuste en render y no en un efecto: React lo resuelve antes de
  // pintar, sin el parpadeo del cajón abierto sobre la página nueva que daría
  // cerrar desde `useEffect`.
  if (lastPath !== pathname) {
    setLastPath(pathname);
    setOpen(false);
  }

  // Con el cajón abierto se bloquea el scroll del fondo, que si no se mueve
  // debajo del overlay.
  useEffect(() => {
    if (!open) return;
    const previous = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.body.style.overflow = previous;
    };
  }, [open]);

  return (
    <>
      {/* Barra superior, solo en móvil. */}
      <div className="border-border bg-surface flex h-12 shrink-0 items-center gap-3 border-b px-3 md:hidden">
        <button
          type="button"
          onClick={() => setOpen(true)}
          aria-label="Abrir el menú"
          aria-expanded={open}
          className="press text-secondary hover:text-primary"
        >
          <Menu size={20} />
        </button>
        <span className="text-primary truncate text-sm font-medium">{workspaceName}</span>
      </div>

      {/* Cajón + fondo, solo en móvil. */}
      {open && (
        <div className="fixed inset-0 z-50 md:hidden">
          <button
            type="button"
            aria-label="Cerrar el menú"
            onClick={() => setOpen(false)}
            className="absolute inset-0 bg-black/40"
          />
          <div className="bg-surface border-border absolute inset-y-0 left-0 flex w-64 flex-col border-r shadow-lg">
            <div className="flex justify-end p-2">
              <button
                type="button"
                onClick={() => setOpen(false)}
                aria-label="Cerrar el menú"
                className="press text-tertiary hover:text-primary"
              >
                <X size={18} />
              </button>
            </div>
            <div className="min-h-0 flex-1 overflow-auto">{children}</div>
          </div>
        </div>
      )}

      {/* Rail de escritorio. */}
      <DesktopRail>{children}</DesktopRail>
    </>
  );
}

/** Columna redimensionable. Separada para que el hook no corra en móvil. */
function DesktopRail({ children }) {
  const { width, dragging, onResizeStart } = useResizableWidth({
    storageKey: 'silmari.sidebarWidth',
    defaultWidth: 224,
    min: 180,
    max: 420,
    side: 'right',
  });

  return (
    <div className="relative hidden h-full shrink-0 md:block" style={{ width }}>
      {children}
      <ResizeHandle side="right" onPointerDown={onResizeStart} active={dragging} />
    </div>
  );
}

export default SidebarShell;
