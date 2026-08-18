'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import Link from 'next/link';
import {
  format,
  addMonths,
  subMonths,
  startOfMonth,
  endOfMonth,
  startOfWeek,
  endOfWeek,
  addDays,
} from 'date-fns';
import { es } from 'date-fns/locale';
import { List, Calendar as CalendarIcon, ChevronLeft, ChevronRight, Trash2 } from 'lucide-react';
import { toast } from 'sonner';
import { Input } from '@/components/ui/Input';
import { Button } from '@/components/ui/Button';
import { AssigneePicker } from './AssigneePicker';
import { TasksCalendar } from './TasksCalendar';
import {
  listTasksAction,
  createActivityAction,
  toggleTaskAction,
  updateActivityAction,
  deleteActivityAction,
  listObjectsAction,
} from '@/app/(workspace)/objects/actions';

const SCOPES = [
  { id: 'all', label: 'Todas' },
  { id: 'mine', label: 'Mías' },
  { id: 'overdue', label: 'Vencidas' },
];

const dayKey = (d) => format(new Date(d), 'yyyy-MM-dd');
/** Guarda la fecha al mediodía local para evitar saltos de día por zona horaria. */
const toDue = (ymd) => (ymd ? new Date(`${ymd}T12:00:00`).toISOString() : null);
const inputClass =
  'border-border-strong bg-surface text-primary mac-focus shadow-xs h-8 rounded-lg border px-2 text-xs';

export function TasksInbox({ currentUserId }) {
  const emptyDraft = () => ({
    title: '',
    date: '',
    assigneeIds: currentUserId ? [currentUserId] : [],
  });
  const [view, setView] = useState('list');
  const [scope, setScope] = useState('all');
  const [month, setMonth] = useState(() => new Date());
  const [tasks, setTasks] = useState([]);
  const [slugById, setSlugById] = useState({});
  const [draft, setDraft] = useState(emptyDraft);
  const titleRef = useRef(null);

  useEffect(() => {
    listObjectsAction().then((r) => {
      if (r.ok) setSlugById(Object.fromEntries(r.data.map((o) => [o.id, o.slug])));
    });
  }, []);

  // Rango de la rejilla del mes (para el fetch del calendario).
  const gridRange = useMemo(() => {
    const from = startOfWeek(startOfMonth(month), { weekStartsOn: 1 });
    const to = addDays(endOfWeek(endOfMonth(month), { weekStartsOn: 1 }), 1);
    return { from: from.toISOString(), to: to.toISOString() };
  }, [month]);

  async function refresh() {
    const args = view === 'calendar' ? { from: gridRange.from, to: gridRange.to } : { scope };
    const r = await listTasksAction(args);
    if (r.ok) setTasks(r.data);
  }
  useEffect(() => {
    refresh(); // eslint-disable-line react-hooks/set-state-in-effect
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [view, scope, gridRange.from, gridRange.to]);

  const tasksByDay = useMemo(() => {
    const m = new Map();
    for (const t of tasks) {
      if (!t.dueAt) continue;
      const k = dayKey(t.dueAt);
      if (!m.has(k)) m.set(k, []);
      m.get(k).push(t);
    }
    return m;
  }, [tasks]);

  const patch = (id, data) =>
    setTasks((prev) => prev.map((t) => (t.id === id ? { ...t, ...data } : t)));

  async function create() {
    const title = draft.title.trim();
    if (!title) return;
    const r = await createActivityAction({
      type: 'TASK',
      title,
      dueAt: toDue(draft.date),
      assigneeIds: draft.assigneeIds,
    });
    if (!r.ok) return toast.error(r.message || 'No se pudo crear la tarea');
    setDraft(emptyDraft());
    refresh();
  }

  async function toggle(id) {
    const r = await toggleTaskAction({ id });
    if (r.ok) patch(id, r.data);
  }
  async function setDue(id, ymd) {
    const dueAt = toDue(ymd);
    patch(id, { dueAt });
    const r = await updateActivityAction({ id, patch: { dueAt } });
    if (!r.ok) {
      toast.error(r.message);
      refresh();
    }
  }
  async function setAssignees(id, ids) {
    patch(id, { assigneeIds: ids });
    const r = await updateActivityAction({ id, patch: { assigneeIds: ids } });
    if (r.ok) patch(id, r.data);
    else refresh();
  }
  async function remove(id) {
    const r = await deleteActivityAction({ id });
    if (r.ok) setTasks((prev) => prev.filter((t) => t.id !== id));
    else toast.error(r.message);
  }

  function recordHref(task) {
    const t = task.targets?.[0];
    const slug = t && slugById[t.objectMetadataId];
    return slug ? `/objects/${slug}/${t.recordId}` : null;
  }

  return (
    <div className="mx-auto w-full max-w-3xl px-6 py-8">
      <div className="mb-4 flex items-center justify-between">
        <h1 className="text-primary text-xl font-semibold tracking-tight">Tareas</h1>
        <div className="mac-segment">
          {[
            ['list', 'Lista', List],
            ['calendar', 'Calendario', CalendarIcon],
          ].map(([id, label, Ico]) => (
            <button
              key={id}
              type="button"
              onClick={() => setView(id)}
              data-active={view === id}
              className="flex items-center gap-1.5 px-2.5 py-1 text-[13px]"
            >
              <Ico size={13} /> {label}
            </button>
          ))}
        </div>
      </div>

      {/* Compositor: título + fecha + responsables */}
      <div className="bg-sunken mb-4 flex flex-wrap items-center gap-2 rounded-xl p-2">
        <Input
          ref={titleRef}
          placeholder="Nueva tarea…"
          value={draft.title}
          onChange={(e) => setDraft((d) => ({ ...d, title: e.target.value }))}
          onKeyDown={(e) => e.key === 'Enter' && create()}
          className="h-8 min-w-40 flex-1 text-[13px]"
        />
        <input
          type="date"
          value={draft.date}
          onChange={(e) => setDraft((d) => ({ ...d, date: e.target.value }))}
          className={inputClass}
          aria-label="Fecha límite"
        />
        <AssigneePicker
          value={draft.assigneeIds}
          onChange={(ids) => setDraft((d) => ({ ...d, assigneeIds: ids }))}
        />
        <Button size="sm" onClick={create} disabled={!draft.title.trim()}>
          Añadir
        </Button>
      </div>

      {view === 'list' ? (
        <>
          <div className="mac-segment mb-3">
            {SCOPES.map((s) => (
              <button
                key={s.id}
                type="button"
                onClick={() => setScope(s.id)}
                data-active={scope === s.id}
                className="px-3 py-1 text-[13px]"
              >
                {s.label}
              </button>
            ))}
          </div>

          <ul className="space-y-1">
            {tasks.length === 0 && <li className="text-tertiary text-sm">No hay tareas</li>}
            {tasks.map((t) => {
              const href = recordHref(t);
              const overdue =
                t.dueAt &&
                t.status !== 'DONE' &&
                new Date(t.dueAt) < new Date(new Date().toDateString());
              return (
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
                    className={`${inputClass} ${overdue ? 'text-danger border-danger/40' : 'text-secondary'}`}
                    aria-label="Fecha límite"
                  />
                  <AssigneePicker
                    value={t.assigneeIds}
                    onChange={(ids) => setAssignees(t.id, ids)}
                  />
                  {href && (
                    <Link href={href} className="text-accent shrink-0 text-xs font-medium">
                      Abrir
                    </Link>
                  )}
                  <button
                    type="button"
                    onClick={() => remove(t.id)}
                    className="text-tertiary hover:text-danger shrink-0 opacity-0 group-hover:opacity-100"
                    aria-label="Borrar tarea"
                  >
                    <Trash2 size={14} />
                  </button>
                </li>
              );
            })}
          </ul>
        </>
      ) : (
        <>
          <div className="mb-3 flex items-center gap-2">
            <button
              type="button"
              onClick={() => setMonth((m) => subMonths(m, 1))}
              className="text-tertiary hover:bg-chip-gray hover:text-primary flex size-7 items-center justify-center rounded-md"
              aria-label="Mes anterior"
            >
              <ChevronLeft size={16} />
            </button>
            <span className="text-primary text-sm font-medium capitalize">
              {format(month, 'LLLL yyyy', { locale: es })}
            </span>
            <button
              type="button"
              onClick={() => setMonth((m) => addMonths(m, 1))}
              className="text-tertiary hover:bg-chip-gray hover:text-primary flex size-7 items-center justify-center rounded-md"
              aria-label="Mes siguiente"
            >
              <ChevronRight size={16} />
            </button>
            <button
              type="button"
              onClick={() => setMonth(new Date())}
              className="text-secondary hover:text-primary ml-1 text-xs font-medium"
            >
              Hoy
            </button>
          </div>
          <TasksCalendar
            month={month}
            tasksByDay={tasksByDay}
            onToggle={(t) => toggle(t.id)}
            onCreateDay={(d) => {
              setDraft((prev) => ({ ...prev, date: format(d, 'yyyy-MM-dd') }));
              titleRef.current?.focus();
            }}
          />
        </>
      )}
    </div>
  );
}

export default TasksInbox;
