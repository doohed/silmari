'use client';

import Link from 'next/link';
import { Table, Columns } from 'lucide-react';

/**
 * Barra única del objeto: pestañas de vista (tabla/kanban) con el recuento de la
 * vista activa a la izquierda, y un hueco de acciones (`children`) a la derecha.
 * Sustituye a las dos barras separadas (pestañas + toolbar) que repetían el
 * nombre de la vista.
 *
 * Hace de **barra de herramientas de la ventana**, así que el cambio de vista
 * es un `.mac-segment` (el mismo control con el que el Finder alterna iconos /
 * lista / columnas) y no unas pestañas web. Con **una sola vista** no se pinta
 * el carril: un control segmentado de un segmento no es un control, es un
 * título — y como título es como se lee.
 *
 * @param {{
 *   objectSlug: string,
 *   views: Array<{ id: string, name: string, type: 'TABLE'|'KANBAN' }>,
 *   activeViewId: string,
 *   count?: number,
 *   children?: import('react').ReactNode,
 * }} props
 */
export function RecordViewBar({ objectSlug, views, activeViewId, count, children }) {
  const single = views.length < 2;
  const active = views.find((v) => v.id === activeViewId) ?? views[0];

  return (
    // `relative z-40`: los popovers que cuelgan de esta barra (filtrar, editar
    // en masa) caen sobre la tabla, y la cabecera pegajosa está en `z-30`. Al
    // empatar en z, ganaba la cabecera por ir después en el DOM y partía el
    // popover por la mitad. El contexto de apilado va aquí, en la barra, y no
    // subiendo el z de cada popover: así vale para los que se añadan después.
    <div className="border-border relative z-40 flex h-12 shrink-0 items-center justify-between gap-3 border-b px-3">
      {single ? (
        <div className="flex min-w-0 items-center gap-2 pl-1">
          <span className="text-primary truncate text-[13px] font-semibold">{active?.name}</span>
          {count != null && <span className="text-tertiary text-xs tabular-nums">{count}</span>}
        </div>
      ) : (
        <div className="mac-segment min-w-0 overflow-hidden">
          {views.map((v) => {
            const isActive = v.id === activeViewId;
            const Icon = v.type === 'KANBAN' ? Columns : Table;
            return (
              <Link
                key={v.id}
                href={`/objects/${objectSlug}?view=${v.id}`}
                data-active={isActive}
                aria-current={isActive ? 'page' : undefined}
                className="flex h-6 min-w-0 items-center gap-1.5 px-2.5 text-[12.5px]"
              >
                <Icon size={13} className={isActive ? '' : 'text-tertiary'} />
                <span className="truncate">{v.name}</span>
                {isActive && count != null && (
                  <span className="text-tertiary ml-0.5 text-[11px] tabular-nums">{count}</span>
                )}
              </Link>
            );
          })}
        </div>
      )}

      {children && <div className="flex shrink-0 items-center gap-1">{children}</div>}
    </div>
  );
}

export default RecordViewBar;
