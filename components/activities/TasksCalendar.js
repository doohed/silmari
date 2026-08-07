'use client';

import { useMemo } from 'react';
import {
  startOfMonth,
  endOfMonth,
  startOfWeek,
  endOfWeek,
  addDays,
  isSameMonth,
  isToday,
  format,
} from 'date-fns';

const WEEKDAYS = ['L', 'M', 'X', 'J', 'V', 'S', 'D'];

/**
 * Rejilla mensual de tareas por `dueAt`. Clic en un día → `onCreateDay(date)`;
 * clic en una tarea → `onToggle(task)`.
 * @param {{ month: Date, tasksByDay: Map<string, object[]>, onCreateDay:(d:Date)=>void, onToggle:(t:object)=>void }} props
 */
export function TasksCalendar({ month, tasksByDay, onCreateDay, onToggle }) {
  const days = useMemo(() => {
    const start = startOfWeek(startOfMonth(month), { weekStartsOn: 1 });
    const end = endOfWeek(endOfMonth(month), { weekStartsOn: 1 });
    const arr = [];
    for (let d = start; d <= end; d = addDays(d, 1)) arr.push(d);
    return arr;
  }, [month]);

  return (
    <div className="border-border overflow-hidden rounded-lg border">
      <div className="border-border text-tertiary grid grid-cols-7 border-b text-[11px] font-medium tracking-wide uppercase">
        {WEEKDAYS.map((w) => (
          <div key={w} className="px-2 py-1.5 text-center">
            {w}
          </div>
        ))}
      </div>
      <div className="grid grid-cols-7">
        {days.map((day) => {
          const key = format(day, 'yyyy-MM-dd');
          const dayTasks = tasksByDay.get(key) ?? [];
          const inMonth = isSameMonth(day, month);
          return (
            <div
              key={key}
              onClick={() => onCreateDay(day)}
              className={`border-border hover:bg-chip-gray/30 min-h-[92px] cursor-pointer border-r border-b p-1.5 ${inMonth ? '' : 'bg-bg/40'}`}
            >
              <span
                className={`flex size-5 items-center justify-center rounded-full text-xs ${
                  isToday(day)
                    ? 'bg-accent text-accent-fg font-medium'
                    : inMonth
                      ? 'text-secondary'
                      : 'text-tertiary'
                }`}
              >
                {format(day, 'd')}
              </span>
              <div className="mt-1 space-y-0.5">
                {dayTasks.slice(0, 3).map((t) => (
                  <button
                    key={t.id}
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      onToggle(t);
                    }}
                    title={t.title || '(sin título)'}
                    className={`block w-full truncate rounded px-1 py-0.5 text-left text-[11px] ${
                      t.status === 'DONE'
                        ? 'text-tertiary line-through'
                        : 'bg-accent-subtle text-primary hover:opacity-80'
                    }`}
                  >
                    {t.title || '(sin título)'}
                  </button>
                ))}
                {dayTasks.length > 3 && (
                  <span className="text-tertiary text-[10px]">+{dayTasks.length - 3} más</span>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

export default TasksCalendar;
