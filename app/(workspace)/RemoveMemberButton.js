'use client';

import { useTransition } from 'react';
import { toast } from 'sonner';
import { removeMemberAction } from './actions';

/**
 * @param {{ userId: string, name: string }} props
 */
export function RemoveMemberButton({ userId, name }) {
  const [pending, startTransition] = useTransition();

  function onClick() {
    startTransition(async () => {
      const result = await removeMemberAction(userId);
      if (result?.ok) toast.success(`${name} eliminado`);
      else toast.error(result?.message ?? 'No se pudo eliminar');
    });
  }

  return (
    <button
      type="button"
      onClick={onClick}
      disabled={pending}
      className="text-tertiary hover:text-danger text-xs transition-colors disabled:opacity-50"
    >
      Eliminar
    </button>
  );
}

export default RemoveMemberButton;
