'use client';

import { useEffect, useState } from 'react';
import { format } from 'date-fns';
import { Trash2 } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { AssigneePicker } from './AssigneePicker';
import {
  listActivitiesAction,
  createActivityAction,
  toggleTaskAction,
  updateActivityAction,
  deleteActivityAction,
} from '@/app/(workspace)/objects/actions';

const dayKey = (d) => format(new Date(d), 'yyyy-MM-dd');
const toDue = (ymd) => (ymd ? new Date(`${ymd}T12:00:00`).toISOString() : null);
const dateInput =
  'border-border bg-surface text-secondary h-8 rounded-md border px-2 text-xs focus:border-accent focus:outline-none';

export function TasksTab({ object, recordId }) {
  const [tasks, setTasks] = useState([]);
  const [draft, setDraft] = useState({ title: '', date: '', assigneeIds: [] });

  async function refresh() {
    const r = await listActivitiesAction({ recordId, type: 'TASK' });
    if (r.ok) setTasks(r.data);
  }
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    refresh();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [recordId]);

  const patch = (id, data) =>
    setTasks((prev) => prev.map((t) => (t.id === id ? { ...t, ...data } : t)));

  async function add(e) {
    e.preventDefault();
    if (!draft.title.trim()) return;
    const r = await createActivityAction({
      type: 'TASK',
      title: draft.title,
      status: 'TODO',
      dueAt: toDue(draft.date),
      assigneeIds: draft.assigneeIds,
      targets: [{ objectMetadataId: object.id, recordId }],
    });
    if (!r.ok) return toast.error(r.message);
    setDraft({ title: '', date: '', assigneeIds: [] });
    refresh();
  }

  async function toggle(id) {
    const r = await toggleTaskAction({ id });
    if (r.ok) patch(id, r.data);
  }
  async function setDue(id, ymd) {
    const dueAt = toDue(ymd);
    patch(id, { dueAt });
    await updateActivityAction({ id, patch: { dueAt } });
  }
  async function setAssignees(id, ids) {
    patch(id, { assigneeIds: ids });
    const r = await updateActivityAction({ id, patch: { assigneeIds: ids } });
    if (r.ok) patch(id, r.data);
  }
  async function remove(id) {
    const r = await deleteActivityAction({ id });
    if (r.ok) setTasks((prev) => prev.filter((t) => t.id !== id));
  }

  return (
    <div className="space-y-4 p-6">
      <form
        onSubmit={add}
        className="border-border bg-bg flex flex-wrap items-center gap-2 rounded-lg border p-2"
      >
        <Input
          placeholder="Nueva tarea"
          value={draft.title}
          onChange={(e) => setDraft((d) => ({ ...d, title: e.target.value }))}
          className="h-8 min-w-40 flex-1 text-[13px]"
        />
        <input
          type="date"
          value={draft.date}
          onChange={(e) => setDraft((d) => ({ ...d, date: e.target.value }))}
          className={dateInput}
          aria-label="Fecha límite"
        />
        <AssigneePicker
          value={draft.assigneeIds}
          onChange={(ids) => setDraft((d) => ({ ...d, assigneeIds: ids }))}
        />
        <Button size="sm" type="submit" disabled={!draft.title.trim()}>
          Añadir
        </Button>
      </form>

      <ul className="space-y-1">
        {tasks.length === 0 && <li className="text-tertiary text-sm">Sin tareas todavía</li>}
        {tasks.map((t) => (
          <li
            key={t.id}
            className="group border-border bg-surface flex items-center gap-2 rounded-md border px-3 py-2"
          >
            <input
              type="checkbox"
              checked={t.status === 'DONE'}
              onChange={() => toggle(t.id)}
              className="accent-accent size-4 shrink-0"
            />
            <span
              className={`min-w-0 flex-1 truncate text-sm ${t.status === 'DONE' ? 'text-tertiary line-through' : 'text-primary'}`}
            >
              {t.title}
            </span>
            <input
              type="date"
              value={t.dueAt ? dayKey(t.dueAt) : ''}
              onChange={(e) => setDue(t.id, e.target.value)}
              className={dateInput}
              aria-label="Fecha límite"
            />
            <AssigneePicker value={t.assigneeIds} onChange={(ids) => setAssignees(t.id, ids)} />
            <button
              type="button"
              onClick={() => remove(t.id)}
              className="text-tertiary hover:text-danger shrink-0 opacity-0 group-hover:opacity-100"
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
