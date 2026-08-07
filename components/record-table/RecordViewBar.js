'use client';

import Link from 'next/link';
import { Table, Columns } from 'lucide-react';

/**
 * Barra única del objeto: pestañas de vista (tabla/kanban) con el recuento de la
 * vista activa a la izquierda, y un hueco de acciones (`children`) a la derecha.
 * Sustituye a las dos barras separadas (pestañas + toolbar) que repetían el
 * nombre de la vista.
 * @param {{
 *   objectSlug: string,
 *   views: Array<{ id: string, name: string, type: 'TABLE'|'KANBAN' }>,
 *   activeViewId: string,
 *   count?: number,
 *   children?: import('react').ReactNode,
 * }} props
 */
export function RecordViewBar({ objectSlug, views, activeViewId, count, children }) {
  return (
    <div className="border-border flex h-11 shrink-0 items-center justify-between gap-3 border-b px-3">
      <div className="flex min-w-0 items-center gap-0.5">
        {views.map((v) => {
          const active = v.id === activeViewId;
          const Icon = v.type === 'KANBAN' ? Columns : Table;
          return (
            <Link
              key={v.id}
              href={`/objects/${objectSlug}?view=${v.id}`}
              aria-current={active ? 'page' : undefined}
              className={
                active
                  ? 'bg-chip-gray text-primary flex h-7 items-center gap-1.5 rounded-md px-2.5 text-[13px] font-medium'
                  : 'text-secondary hover:bg-chip-gray/60 hover:text-primary flex h-7 items-center gap-1.5 rounded-md px-2.5 text-[13px]'
              }
            >
              <Icon size={13} className={active ? 'text-primary' : 'text-tertiary'} />
              <span className="truncate">{v.name}</span>
              {active && count != null && (
                <span className="text-tertiary ml-0.5 text-xs tabular-nums">{count}</span>
              )}
            </Link>
          );
        })}
      </div>

      {children && <div className="flex shrink-0 items-center gap-1.5">{children}</div>}
    </div>
  );
}

export default RecordViewBar;
