'use client';

import { useEffect, useState } from 'react';
import { Trash2 } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import {
  listActivitiesAction,
  createActivityAction,
  toggleTaskAction,
  deleteActivityAction,
} from '@/app/(workspace)/objects/actions';

export function TasksTab({ object, recordId }) {
  const [tasks, setTasks] = useState([]);
  const [title, setTitle] = useState('');

  async function refresh() {
    const r = await listActivitiesAction({ recordId, type: 'TASK' });
    if (r.ok) setTasks(r.data);
  }
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    refresh();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [recordId]);

  async function add(e) {
    e.preventDefault();
    if (!title.trim()) return;
    const r = await createActivityAction({
      type: 'TASK',
      title,
      status: 'TODO',
      targets: [{ objectMetadataId: object.id, recordId }],
    });
    if (!r.ok) return toast.error(r.message);
    setTitle('');
    refresh();
  }

  async function toggle(id) {
    const r = await toggleTaskAction({ id });
    if (r.ok) setTasks((prev) => prev.map((t) => (t.id === id ? r.data : t)));
  }

  async function remove(id) {
    const r = await deleteActivityAction({ id });
    if (r.ok) refresh();
  }

  return (
    <div className="space-y-4 p-6">
      <form onSubmit={add} className="flex gap-2">
        <Input placeholder="Nueva tarea" value={title} onChange={(e) => setTitle(e.target.value)} />
        <Button size="sm" type="submit">
          Añadir
        </Button>
      </form>

      <ul className="space-y-1">
        {tasks.length === 0 && <li className="text-tertiary text-sm">Sin tareas todavía</li>}
        {tasks.map((t) => (
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
            <button
              type="button"
              onClick={() => remove(t.id)}
              className="text-tertiary hover:text-danger"
              aria-label="Eliminar tarea"
            >
              <Trash2 size={14} />
            </button>
          </li>
        ))}
      </ul>
    </div>
  );
}

export default TasksTab;
