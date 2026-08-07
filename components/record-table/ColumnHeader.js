'use client';

import { useState } from 'react';
import { ChevronUp, ChevronDown, MoreHorizontal } from 'lucide-react';

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

  return (
    <div className="group text-tertiary relative flex h-full items-center pr-1 pl-2 text-[11px] font-medium tracking-wide uppercase select-none">
      <button
        type="button"
        onClick={onSort}
        className="hover:text-primary flex min-w-0 flex-1 items-center gap-1 truncate text-left"
      >
        <span className="truncate">{label}</span>
        {sortDir === 'asc' && <ChevronUp size={13} />}
        {sortDir === 'desc' && <ChevronDown size={13} />}
      </button>

      <button
        type="button"
        onClick={() => setMenu((m) => !m)}
        onBlur={() => setTimeout(() => setMenu(false), 120)}
        className="text-tertiary hover:text-primary opacity-0 group-hover:opacity-100"
        aria-label="Opciones de columna"
      >
        <MoreHorizontal size={14} />
      </button>

      {menu && (
        <div className="border-border bg-elevated absolute top-full right-0 z-30 mt-1 w-40 rounded-md border p-1 text-left shadow-lg">
          {[
            ['Ocultar', onHide],
            ['Mover a la izquierda', onMoveLeft],
            ['Mover a la derecha', onMoveRight],
          ].map(([text, fn]) => (
            <button
              key={text}
              type="button"
              className="hover:bg-chip-gray text-primary block w-full rounded px-2 py-1 text-left text-xs"
              onMouseDown={(e) => {
                e.preventDefault();
                fn?.();
                setMenu(false);
              }}
            >
              {text}
            </button>
          ))}
        </div>
      )}

      <div
        onMouseDown={onResizeStart}
        className="hover:bg-accent absolute top-0 right-0 h-full w-1 cursor-col-resize touch-none"
      />
    </div>
  );
}

export default ColumnHeader;
