'use client';

import { useRef, useState } from 'react';
import { ChevronUp, ChevronDown } from 'lucide-react';
import { useClickOutside } from '@/hooks/useClickOutside';

/**
 * Cabecera de columna: etiqueta, indicador de orden (click para ciclar) y menú
 * (ocultar / mover). El asa de redimensionado la aporta TanStack Table.
 *
 * Se parece a la cabecera de la vista de lista del Finder y no a la de una
 * tabla web: **texto normal, no versalitas**. Las mayúsculas con `tracking`
 * ancho son la marca de los dashboards web; el sistema escribe la etiqueta tal
 * cual, un punto más pequeña que el cuerpo, y marca la columna ordenada
 * tiñéndola. El menú se abre con el botón derecho sobre la cabecera (como el
 * del sistema) además de con el chevron, que solo aparece al pasar el cursor.
 *
 * @param {object} props
 * @param {string} props.label
 * @param {'asc'|'desc'|null} props.sortDir
 * @param {'left'|'right'} [props.align]  derecha en columnas numéricas
 * @param {boolean} [props.sortable]  false en los tipos que la BD no sabe ordenar
 */
export function ColumnHeader({
  label,
  sortDir,
  align = 'left',
  sortable = true,
  onSort,
  onHide,
  onMoveLeft,
  onMoveRight,
  onResizeStart,
}) {
  const [menu, setMenu] = useState(false);
  const menuRef = useRef(null);
  useClickOutside(menuRef, () => setMenu(false), menu);

  const right = align === 'right';

  return (
    <div
      onContextMenu={(e) => {
        e.preventDefault();
        setMenu(true);
      }}
      className={`group relative flex h-full items-center text-[11.5px] font-medium select-none ${
        // La sangría del título tiene que ser la MISMA que la del valor de la
        // celda (`CellContent`), o la columna se lee torcida. En las columnas
        // numéricas el lado que cuenta es el derecho, así que el padding se
        // invierte y el chevron del menú se va a la izquierda: si se queda a la
        // derecha, empuja la etiqueta y deja de cuadrar con las cifras.
        right ? 'pr-3 pl-2' : 'pr-2 pl-3'
      } ${sortDir ? 'text-primary' : 'text-secondary'}`}
    >
      {/* Los tipos sin hoja escalar (arrays, calculados) no se pueden ordenar en
        la BD: el título deja de ser un botón en vez de ofrecer una acción que
        el servidor va a rechazar. */}
      <button
        type="button"
        onClick={onSort}
        disabled={!sortable}
        title={sortable ? `Ordenar por ${label}` : `No se puede ordenar por ${label}`}
        className={`flex min-w-0 flex-1 items-center gap-1 truncate ${
          sortable ? 'hover:text-primary' : 'cursor-default'
        } ${right ? 'flex-row-reverse text-right' : 'text-left'}`}
      >
        <span className="truncate">{label}</span>
        {sortDir === 'asc' && <ChevronUp size={12} strokeWidth={2.5} className="shrink-0" />}
        {sortDir === 'desc' && <ChevronDown size={12} strokeWidth={2.5} className="shrink-0" />}
      </button>

      <div ref={menuRef} className={`relative ${right ? 'order-first' : ''}`}>
        <button
          type="button"
          onClick={() => setMenu((m) => !m)}
          className="text-tertiary hover:text-primary flex items-center opacity-0 group-hover:opacity-100 aria-expanded:opacity-100"
          aria-expanded={menu}
          aria-label="Opciones de columna"
        >
          <ChevronDown size={12} />
        </button>

        {menu && (
          <div className="mac-menu anim-pop absolute top-full right-0 z-40 mt-1 w-44 p-1 text-left">
            {[
              ['Ocultar columna', onHide],
              ['Mover a la izquierda', onMoveLeft],
              ['Mover a la derecha', onMoveRight],
            ].map(([text, fn]) => (
              <button
                key={text}
                type="button"
                className="text-primary hover:bg-accent hover:text-accent-fg block w-full rounded-md px-2 py-1 text-left text-[13px] font-normal"
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

      {/* Asa de redimensionado: invisible hasta que se toca, como el separador
        de columnas del sistema. Va **entera dentro de la columna**, pegada a su
        borde derecho: al sobresalir hacia la siguiente, el cursor de
        redimensionado aparecía sobre el borde IZQUIERDO de la columna de al
        lado y parecía que se estuviera cambiando el ancho de esa otra. */}
      <div
        onMouseDown={onResizeStart}
        className="group/rz absolute top-0 right-0 z-10 flex h-full w-[5px] cursor-col-resize touch-none justify-end"
      >
        <span className="bg-accent h-full w-px opacity-0 group-hover/rz:opacity-100" />
      </div>
    </div>
  );
}

export default ColumnHeader;
