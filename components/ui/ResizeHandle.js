'use client';

import { cn } from '@/lib/utils/cn';

/**
 * Asa vertical para redimensionar un panel arrastrando. Se coloca sobre el borde
 * (`side`) del contenedor `relative` que la contiene.
 * @param {{
 *   side: 'left' | 'right',
 *   onPointerDown: (e: React.PointerEvent) => void,
 *   active?: boolean,
 * }} props
 */
export function ResizeHandle({ side, onPointerDown, active = false }) {
  return (
    <div
      role="separator"
      aria-orientation="vertical"
      onPointerDown={onPointerDown}
      className={cn(
        'group absolute top-0 z-20 flex h-full w-2 cursor-col-resize touch-none justify-center',
        side === 'left' ? '-left-1' : '-right-1',
      )}
    >
      <span
        className={cn(
          'h-full w-px transition-colors',
          active ? 'bg-accent' : 'group-hover:bg-accent/50 bg-transparent',
        )}
      />
    </div>
  );
}

export default ResizeHandle;
