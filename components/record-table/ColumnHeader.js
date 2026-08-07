'use client';

import { useRef, useState } from 'react';
import { ChevronUp, ChevronDown, MoreHorizontal } from 'lucide-react';
import { useClickOutside } from '@/hooks/useClickOutside';

/**
 * Cabecera de columna: etiqueta, indicador de orden (click para ciclar) y menú
 * (ocultar / mover). El asa de redimensionado la aporta TanStack Table.
 */
export function ColumnHeader({
  label,
  sortDir,
  onSort,
  onHide,
  onMoveLeft,
  onMoveRight,
  onResizeStart,
}) {
  const [menu, setMenu] = useState(false);
  const menuRef = useRef(null);
  useClickOutside(menuRef, () => setMenu(false), menu);

  return (
    <div className="group text-tertiary relative flex h-full items-center pr-1 pl-2 text-xs font-medium tracking-wide uppercase select-none">
      <button
        type="button"
        onClick={onSort}
        className="hover:text-primary flex min-w-0 flex-1 items-center gap-1 truncate text-left"
      >
        <span className="truncate">{label}</span>
        {sortDir === 'asc' && <ChevronUp size={13} />}
        {sortDir === 'desc' && <ChevronDown size={13} />}
      </button>

      <div ref={menuRef} className="relative">
        <button
          type="button"
          onClick={() => setMenu((m) => !m)}
          className="text-tertiary hover:text-primary opacity-0 group-hover:opacity-100 aria-expanded:opacity-100"
          aria-expanded={menu}
          aria-label="Opciones de columna"
        >
          <MoreHorizontal size={14} />
        </button>

        {menu && (
          <div className="border-border bg-elevated absolute top-full right-0 z-40 mt-1 w-40 rounded-md border p-1 text-left shadow-lg">
            {[
              ['Ocultar', onHide],
              ['Mover a la izquierda', onMoveLeft],
              ['Mover a la derecha', onMoveRight],
            ].map(([text, fn]) => (
              <button
                key={text}
                type="button"
                className="hover:bg-chip-gray text-primary block w-full rounded px-2 py-1 text-left text-xs"
                onClick={() => {
                  fn?.();
                  setMenu(false);
                }}
              >
                {text}
              </button>
            ))}
          </div>
        )}
      </div>

      <div
        onMouseDown={onResizeStart}
        className="hover:bg-accent absolute top-0 right-0 h-full w-1 cursor-col-resize touch-none"
      />
    </div>
  );
}

export default ColumnHeader;
