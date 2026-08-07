'use client';

import { useState } from 'react';
import { RotateCcw, Trash2 } from 'lucide-react';
import { toast } from 'sonner';
import { Icon } from '@/components/ui/Icon';
import {
  listTrashAction,
  restoreRecordAction,
  hardDeleteRecordAction,
} from '@/app/(workspace)/objects/actions';

export function TrashPanel({ initialGroups }) {
  const [groups, setGroups] = useState(initialGroups);

  async function refresh() {
    const r = await listTrashAction();
    if (r.ok) setGroups(r.data);
  }

  async function restore(slug, id) {
    const r = await restoreRecordAction({ objectSlug: slug, recordId: id });
    if (r.ok) {
      toast.success('Registro restaurado');
      refresh();
    } else toast.error(r.message);
  }

  async function purge(slug, id) {
    const r = await hardDeleteRecordAction({ objectSlug: slug, recordId: id });
    if (r.ok) {
      toast.success('Eliminado definitivamente');
      refresh();
    } else toast.error(r.message);
  }

  if (groups.length === 0) {
    return <p className="text-tertiary text-sm">La papelera está vacía</p>;
  }

  return (
    <div className="space-y-5">
      {groups.map((g) => (
        <section key={g.object.id}>
          <div className="text-tertiary mb-1 flex items-center gap-1.5 text-[11px] font-medium tracking-wider uppercase">
            <Icon name={g.object.icon} size={13} />
            {g.object.labelPlural}
          </div>
          <ul className="border-border bg-surface divide-border divide-y rounded-lg border">
            {g.records.map((r) => (
              <li key={r.id} className="flex items-center gap-2 px-4 py-2.5">
                <span className="text-primary min-w-0 flex-1 truncate text-sm">{r.label}</span>
                <button
                  type="button"
                  onClick={() => restore(g.object.slug, r.id)}
                  className="text-tertiary hover:text-primary"
                  aria-label="Restaurar"
                >
                  <RotateCcw size={14} />
                </button>
                <button
                  type="button"
                  onClick={() => purge(g.object.slug, r.id)}
                  className="text-tertiary hover:text-danger"
                  aria-label="Borrar definitivamente"
                >
                  <Trash2 size={14} />
                </button>
              </li>
            ))}
          </ul>
        </section>
      ))}
    </div>
  );
}

export default TrashPanel;
