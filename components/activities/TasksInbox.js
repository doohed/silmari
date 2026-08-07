'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import {
  listTasksAction,
  toggleTaskAction,
  listObjectsAction,
} from '@/app/(workspace)/objects/actions';

const SCOPES = [
  { id: 'all', label: 'Todas' },
  { id: 'mine', label: 'Mías' },
  { id: 'overdue', label: 'Vencidas' },
];

export function TasksInbox() {
  const [scope, setScope] = useState('all');
  const [tasks, setTasks] = useState([]);
  const [slugById, setSlugById] = useState({});

  useEffect(() => {
    listObjectsAction().then((r) => {
      if (r.ok) setSlugById(Object.fromEntries(r.data.map((o) => [o.id, o.slug])));
    });
  }, []);

  async function refresh() {
    const r = await listTasksAction({ scope });
    if (r.ok) setTasks(r.data);
  }
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    refresh();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [scope]);

  async function toggle(id) {
    const r = await toggleTaskAction({ id });
    if (r.ok) setTasks((prev) => prev.map((t) => (t.id === id ? r.data : t)));
  }

  function recordHref(task) {
    const t = task.targets?.[0];
    const slug = t && slugById[t.objectMetadataId];
    return slug ? `/objects/${slug}/${t.recordId}` : null;
  }

  return (
    <div className="mx-auto w-full max-w-2xl px-6 py-8">
      <h1 className="text-primary mb-4 text-xl font-semibold tracking-tight">Tareas</h1>

      <div className="mb-4 flex gap-1">
        {SCOPES.map((s) => (
          <button
            key={s.id}
            type="button"
            onClick={() => setScope(s.id)}
            className={`rounded-md px-3 py-1 text-sm transition-colors ${
              scope === s.id
                ? 'bg-accent-subtle text-primary font-medium'
                : 'text-secondary hover:bg-chip-gray'
            }`}
          >
            {s.label}
          </button>
        ))}
      </div>

      <ul className="space-y-1">
        {tasks.length === 0 && <li className="text-tertiary text-sm">No hay tareas</li>}
        {tasks.map((t) => {
          const href = recordHref(t);
          return (
            <li
              key={t.id}
              className="border-border bg-surface flex items-center gap-2 rounded-md border px-3 py-2"
            >
              <input
                type="checkbox"
                checked={t.status === 'DONE'}
                onChange={() => toggle(t.id)}
                className="accent-accent size-4"
              />
              <span
                className={`min-w-0 flex-1 truncate text-sm ${t.status === 'DONE' ? 'text-tertiary line-through' : 'text-primary'}`}
              >
                {t.title}
              </span>
              {href && (
                <Link href={href} className="text-accent shrink-0 text-xs font-medium">
                  Abrir
                </Link>
              )}
            </li>
          );
        })}
      </ul>
    </div>
  );
}

export default TasksInbox;
