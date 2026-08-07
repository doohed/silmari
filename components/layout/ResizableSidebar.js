'use client';

import { useResizableWidth } from '@/hooks/useResizableWidth';
import { ResizeHandle } from '@/components/ui/ResizeHandle';

/**
 * Envuelve el rail de navegación (Server Component pasado como `children`) para
 * darle un ancho redimensionable por arrastre, persistido en localStorage.
 */
export function ResizableSidebar({ children }) {
  const { width, dragging, onResizeStart } = useResizableWidth({
    storageKey: 'silmari.sidebarWidth',
    defaultWidth: 224,
    min: 180,
    max: 420,
    side: 'right',
  });

  return (
    <div className="relative h-full shrink-0" style={{ width }}>
      {children}
      <ResizeHandle side="right" onPointerDown={onResizeStart} active={dragging} />
    </div>
  );
}

export default ResizableSidebar;
