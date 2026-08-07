'use client';

import { useTransition } from 'react';
import { ChevronsUpDown } from 'lucide-react';
import { switchWorkspaceAction } from '@/app/(workspace)/actions';

/**
 * Selector de workspace activo (fila del sidebar): solo el nombre. Con varios
 * workspaces muestra un desplegable nativo superpuesto que re-firma la sesión al
 * cambiar; con uno solo, solo el nombre.
 * @param {{ workspaces: Array<{ id: string, name: string }>, activeId: string }} props
 */
export function WorkspaceSwitcher({ workspaces, activeId }) {
  const [pending, startTransition] = useTransition();
  const active = workspaces.find((w) => w.id === activeId) ?? workspaces[0];
  const name = active?.name ?? 'Silmari';
  const multi = workspaces.length > 1;

  return (
    <div className="relative">
      <div
        className={`flex h-8 items-center gap-1.5 rounded-md px-1.5 ${multi ? 'hover:bg-chip-gray' : ''}`}
      >
        <span className="text-primary min-w-0 flex-1 truncate text-[13px] font-semibold">
          {name}
        </span>
        {multi && <ChevronsUpDown size={13} className="text-tertiary shrink-0" />}
      </div>
      {multi && (
        <select
          value={active.id}
          disabled={pending}
          onChange={(e) => startTransition(() => switchWorkspaceAction(e.target.value))}
          aria-label="Cambiar de espacio de trabajo"
          className="absolute inset-0 cursor-pointer opacity-0"
        >
          {workspaces.map((w) => (
            <option key={w.id} value={w.id}>
              {w.name}
            </option>
          ))}
        </select>
      )}
    </div>
  );
}

export default WorkspaceSwitcher;
