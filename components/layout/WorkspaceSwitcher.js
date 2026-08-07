'use client';

import { useTransition } from 'react';
import { switchWorkspaceAction } from '@/app/(workspace)/actions';

/**
 * Selector de workspace activo. Al cambiar, re-firma la sesión en el servidor.
 * @param {{ workspaces: Array<{ id: string, name: string }>, activeId: string }} props
 */
export function WorkspaceSwitcher({ workspaces, activeId }) {
  const [pending, startTransition] = useTransition();

  if (workspaces.length <= 1) {
    return (
      <span className="text-primary text-sm font-medium">{workspaces[0]?.name ?? 'Silmari'}</span>
    );
  }

  return (
    <select
      value={activeId}
      disabled={pending}
      onChange={(e) => startTransition(() => switchWorkspaceAction(e.target.value))}
      className="border-border bg-surface text-primary focus:border-accent h-8 rounded-md border px-2 text-sm focus:outline-none"
      aria-label="Cambiar de espacio de trabajo"
    >
      {workspaces.map((w) => (
        <option key={w.id} value={w.id}>
          {w.name}
        </option>
      ))}
    </select>
  );
}

export default WorkspaceSwitcher;
