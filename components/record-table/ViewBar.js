'use client';

import Link from 'next/link';
import { Table, Columns } from 'lucide-react';

/**
 * Barra de vistas: pestañas para cambiar entre vistas (tabla/kanban) vía `?view`.
 * @param {{ objectSlug: string, views: object[], activeViewId: string }} props
 */
export function ViewBar({ objectSlug, views, activeViewId }) {
  return (
    <div className="border-border flex h-10 shrink-0 items-center gap-1 border-b px-3">
      {views.map((v) => {
        const active = v.id === activeViewId;
        const Icon = v.type === 'KANBAN' ? Columns : Table;
        return (
          <Link
            key={v.id}
            href={`/objects/${objectSlug}?view=${v.id}`}
            className={`flex items-center gap-1.5 rounded-md px-2.5 py-1 text-xs transition-colors ${
              active
                ? 'bg-accent-subtle text-primary font-medium'
                : 'text-secondary hover:bg-chip-gray hover:text-primary'
            }`}
          >
            <Icon size={13} />
            {v.name}
          </Link>
        );
      })}
    </div>
  );
}

export default ViewBar;
