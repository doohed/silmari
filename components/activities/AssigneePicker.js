'use client';

import { useEffect, useRef, useState } from 'react';
import { UserPlus, Check } from 'lucide-react';
import { Avatar } from '@/components/ui/Avatar';
import { useClickOutside } from '@/hooks/useClickOutside';
import { listMemberOptionsAction } from '@/app/(workspace)/objects/actions';

/**
 * Selector de responsables (varios miembros del workspace).
 * @param {{ value?: string[], onChange: (ids: string[]) => void }} props
 */
export function AssigneePicker({ value = [], onChange }) {
  const [open, setOpen] = useState(false);
  const [members, setMembers] = useState([]);
  const ref = useRef(null);
  useClickOutside(ref, () => setOpen(false), open);

  useEffect(() => {
    listMemberOptionsAction().then((r) => {
      if (r?.ok) setMembers(r.data);
    });
  }, []);

  const selected = members.filter((m) => value.includes(m.id));
  const toggle = (id) =>
    onChange(value.includes(id) ? value.filter((x) => x !== id) : [...value, id]);

  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-expanded={open}
        className="press border-border hover:bg-chip-gray flex h-8 items-center gap-1.5 rounded-md border px-2 text-xs"
      >
        {selected.length === 0 ? (
          <>
            <UserPlus size={13} className="text-tertiary" />
            <span className="text-tertiary">Responsables</span>
          </>
        ) : (
          <span className="flex items-center">
            <span className="flex -space-x-1.5">
              {selected.slice(0, 3).map((m) => (
                <Avatar
                  key={m.id}
                  name={m.label}
                  src={m.avatarUrl}
                  size={18}
                  className="ring-surface ring-2"
                />
              ))}
            </span>
            {selected.length > 3 && (
              <span className="text-tertiary ml-2">+{selected.length - 3}</span>
            )}
          </span>
        )}
      </button>

      {open && (
        <div className="anim-pop border-border bg-elevated absolute top-full left-0 z-40 mt-1 max-h-60 w-56 overflow-auto rounded-md border p-1 shadow-md">
          {members.length === 0 && <p className="text-tertiary px-2 py-1 text-xs">Sin miembros</p>}
          {members.map((m) => {
            const on = value.includes(m.id);
            return (
              <button
                key={m.id}
                type="button"
                onClick={() => toggle(m.id)}
                className={`flex w-full items-center gap-2 rounded px-1.5 py-1 text-left text-sm ${on ? 'bg-chip-gray' : 'hover:bg-chip-gray'}`}
              >
                <Avatar name={m.label} src={m.avatarUrl} size={18} />
                <span className="text-primary min-w-0 flex-1 truncate">{m.label}</span>
                {on && <Check size={14} className="text-accent shrink-0" />}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}

export default AssigneePicker;
