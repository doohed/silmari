'use client';

import { Plus } from 'lucide-react';
import { Button } from '@/components/ui/Button';

/**
 * Estado vacío: invitación a crear el primer registro.
 * @param {{ label: string, onCreate: ()=>void }} props
 */
export function EmptyState({ label, onCreate }) {
  return (
    <div className="anim-fade-up flex flex-1 flex-col items-center justify-center gap-3 p-10 text-center">
      <div className="bg-accent-subtle text-accent mb-1 flex size-14 items-center justify-center rounded-2xl shadow-sm">
        <Plus size={24} />
      </div>
      <p className="text-primary text-base font-medium">Aún no hay {label.toLowerCase()}</p>
      <p className="text-secondary max-w-xs text-xs">
        Crea el primer registro para empezar a trabajar.
      </p>
      <Button size="sm" onClick={onCreate}>
        <Plus size={14} /> Crear {label.toLowerCase()}
      </Button>
    </div>
  );
}

export default EmptyState;
