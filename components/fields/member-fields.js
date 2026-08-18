'use client';

import { useEffect, useRef, useState } from 'react';
import { Avatar } from '@/components/ui/Avatar';
import { cellInputClass } from './cell-keys';
import { useClickOutside } from '@/hooks/useClickOutside';
import { listMemberOptionsAction } from '@/app/(workspace)/objects/actions';

const empty = <span className="text-tertiary">—</span>;

/** Display: recibe el miembro hidratado `{ id, label, avatarUrl }` (lo pasa la tabla/ficha). */
function MemberDisplay({ relation }) {
  if (!relation?.id) return empty;
  return (
    <span className="flex min-w-0 items-center gap-1.5">
      <Avatar name={relation.label} src={relation.avatarUrl} size={18} />
      <span className="truncate">{relation.label}</span>
    </span>
  );
}

/** Edit: desplegable con los miembros del workspace (avatar + nombre). */
function MemberEdit({ value, onCommit, onCancel }) {
  const [members, setMembers] = useState([]);
  const ref = useRef(null);
  useClickOutside(ref, onCancel);

  useEffect(() => {
    let active = true;
    listMemberOptionsAction().then((r) => {
      if (active && r?.ok) setMembers(r.data);
    });
    return () => {
      active = false;
    };
  }, []);

  return (
    <div
      ref={ref}
      className="relative h-full w-full"
      onKeyDown={(e) => {
        if (e.key === 'Escape') {
          e.preventDefault();
          onCancel();
        }
      }}
    >
      <div className={cellInputClass}>Elegir miembro…</div>
      <div className="mac-menu absolute top-full left-0 z-20 mt-1 max-h-60 w-64 overflow-auto rounded-md border p-1 shadow-lg">
        <button
          type="button"
          className="hover:bg-chip-gray text-tertiary flex w-full rounded px-1.5 py-1 text-left text-xs"
          onMouseDown={(e) => {
            e.preventDefault();
            onCommit(null);
          }}
        >
          Vaciar
        </button>
        {members.length === 0 && <p className="text-tertiary px-1.5 py-1 text-xs">Sin miembros</p>}
        {members.map((m) => (
          <button
            key={m.id}
            type="button"
            className={`hover:bg-chip-gray flex w-full items-center gap-2 rounded px-1.5 py-1 text-left text-sm ${m.id === value ? 'bg-chip-gray' : ''}`}
            onMouseDown={(e) => {
              e.preventDefault();
              onCommit(m.id);
            }}
          >
            <Avatar name={m.label} src={m.avatarUrl} size={18} />
            <span className="truncate">{m.label}</span>
          </button>
        ))}
      </div>
    </div>
  );
}

export const memberTypes = {
  MEMBER: { Display: MemberDisplay, Edit: MemberEdit },
};
