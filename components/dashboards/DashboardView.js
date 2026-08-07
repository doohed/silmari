'use client';

import { useRef, useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import {
  DndContext,
  closestCenter,
  PointerSensor,
  useSensor,
  useSensors,
} from '@dnd-kit/core';
import {
  SortableContext,
  rectSortingStrategy,
  useSortable,
  arrayMove,
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { Plus, X, GripVertical, Pencil, Check, Scaling, ChevronLeft } from 'lucide-react';
import { toast } from 'sonner';
import { WIDGETS, defaultSizeFor, nextSize } from '@/lib/dashboards/catalog';
import {
  updateDashboardWidgetsAction,
  renameDashboardAction,
} from '@/app/(workspace)/dashboards/actions';
import { Widget } from './Widget';

/**
 * Detalle de un panel: cabecera con vuelta a la lista y título renombrable, más
 * la rejilla de widgets del catálogo. En modo edición se pueden añadir, quitar y
 * reordenar widgets (se guarda al momento).
 * @param {{
 *   dashboard: { id:string, name:string, widgets: Array<{id:string,type:string,w:number,h:number}> },
 *   metrics: object,
 * }} props
 */
export function DashboardView({ dashboard, metrics }) {
  const router = useRouter();
  const [widgets, setWidgets] = useState(dashboard.widgets);
  const [name, setName] = useState(dashboard.name);
  const [editing, setEditing] = useState(false);
  const [adding, setAdding] = useState(false);
  const [renaming, setRenaming] = useState(false);
  const [pending, startTransition] = useTransition();
  const renameRef = useRef(null);

  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 5 } }));

  async function persist(next) {
    setWidgets(next);
    const r = await updateDashboardWidgetsAction({ id: dashboard.id, widgets: next });
    if (!r.ok) toast.error(r.message || 'No se pudo guardar el panel');
  }

  function onDragEnd(e) {
    const { active: a, over } = e;
    if (!over || a.id === over.id) return;
    const from = widgets.findIndex((w) => w.id === a.id);
    const to = widgets.findIndex((w) => w.id === over.id);
    persist(arrayMove(widgets, from, to));
  }

  const add = (type) => {
    persist([...widgets, { id: crypto.randomUUID(), type, ...defaultSizeFor(type) }]);
    setAdding(false);
  };
  const remove = (id) => persist(widgets.filter((w) => w.id !== id));
  const resize = (id) =>
    persist(widgets.map((w) => (w.id === id ? { ...w, ...nextSize({ w: w.w, h: w.h }) } : w)));

  const submitRename = () => {
    const next = (renameRef.current?.value ?? '').trim();
    setRenaming(false);
    if (!next || next === name) return;
    setName(next);
    startTransition(async () => {
      const r = await renameDashboardAction({ id: dashboard.id, name: next });
      if (!r.ok) {
        setName(dashboard.name);
        return toast.error(r.message || 'No se pudo renombrar');
      }
      router.refresh();
    });
  };

  return (
    <div className="flex h-full flex-col">
      <div className="border-border flex h-12 shrink-0 items-center justify-between gap-3 border-b px-6">
        <div className="flex min-w-0 items-center gap-2">
          <button
            type="button"
            onClick={() => router.push('/dashboards')}
            className="press text-tertiary hover:bg-chip-gray hover:text-primary flex h-8 w-8 shrink-0 items-center justify-center rounded-lg"
            aria-label="Volver a paneles"
            title="Volver a paneles"
          >
            <ChevronLeft size={16} />
          </button>
          {renaming ? (
            <input
              ref={renameRef}
              defaultValue={name}
              autoFocus
              maxLength={60}
              disabled={pending}
              onBlur={submitRename}
              onKeyDown={(e) => {
                if (e.key === 'Enter') submitRename();
                if (e.key === 'Escape') setRenaming(false);
              }}
              className="border-accent bg-surface text-primary h-8 rounded-lg border px-2.5 text-sm font-semibold focus:outline-none"
              aria-label="Nombre del panel"
            />
          ) : (
            <button
              type="button"
              onClick={() => setRenaming(true)}
              title="Clic para renombrar"
              className="hover:bg-chip-gray text-primary flex h-8 max-w-md items-center rounded-lg px-2 text-sm font-semibold"
            >
              <span className="truncate">{name}</span>
            </button>
          )}
        </div>
        <div className="relative flex shrink-0 items-center gap-2">
          {editing && (
            <button
              type="button"
              onClick={() => setAdding((a) => !a)}
              className="press border-border text-primary hover:bg-chip-gray flex h-8 items-center gap-1.5 rounded-lg border px-3 text-xs font-medium"
            >
              <Plus size={14} /> Añadir widget
            </button>
          )}
          <button
            type="button"
            onClick={() => {
              setEditing((e) => !e);
              setAdding(false);
            }}
            className="press bg-accent text-accent-fg flex h-8 items-center gap-1.5 rounded-lg px-3 text-xs font-medium"
          >
            {editing ? <Check size={14} /> : <Pencil size={14} />} {editing ? 'Hecho' : 'Editar'}
          </button>
          {adding && <AddMenu existing={widgets} onAdd={add} onClose={() => setAdding(false)} />}
        </div>
      </div>

      <div className="min-h-0 flex-1 overflow-auto p-6">
        {widgets.length === 0 ? (
          <p className="text-tertiary text-sm">
            Este panel está vacío. Pulsa <span className="font-medium">Editar</span> y añade widgets.
          </p>
        ) : (
          <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={onDragEnd}>
            <SortableContext items={widgets.map((w) => w.id)} strategy={rectSortingStrategy}>
              <div className="grid auto-rows-[7.5rem] grid-flow-dense grid-cols-2 gap-4 md:grid-cols-4">
                {widgets.map((w) => (
                  <SortableCard
                    key={w.id}
                    widget={w}
                    metrics={metrics}
                    editing={editing}
                    onRemove={() => remove(w.id)}
                    onResize={() => resize(w.id)}
                  />
                ))}
              </div>
            </SortableContext>
          </DndContext>
        )}
      </div>
    </div>
  );
}

function SortableCard({ widget, metrics, editing, onRemove, onResize }) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: widget.id,
    disabled: !editing,
  });
  const def = WIDGETS.find((x) => x.type === widget.type);

  const style = {
    transform: CSS.Translate.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
    gridColumn: `span ${widget.w}`,
    gridRow: `span ${widget.h}`,
  };

  return (
    <div
      ref={setNodeRef}
      style={style}
      className="border-border bg-surface flex min-h-0 flex-col rounded-xl border p-4 shadow-sm"
    >
      <div className="mb-2 flex items-center justify-between gap-2">
        <p className="text-secondary truncate text-xs font-medium">{def?.title ?? widget.type}</p>
        {editing && (
          <div className="flex items-center gap-1.5">
            <button
              type="button"
              onClick={onResize}
              className="text-tertiary hover:text-primary"
              aria-label="Cambiar tamaño"
              title={`Tamaño ${widget.w}×${widget.h} · clic para cambiar`}
            >
              <Scaling size={14} />
            </button>
            <button
              type="button"
              onClick={onRemove}
              className="text-tertiary hover:text-danger"
              aria-label="Quitar widget"
            >
              <X size={14} />
            </button>
            <span
              {...attributes}
              {...listeners}
              className="text-tertiary hover:text-secondary cursor-grab active:cursor-grabbing"
              aria-label="Reordenar"
            >
              <GripVertical size={14} />
            </span>
          </div>
        )}
      </div>
      <div className="min-h-0 flex-1">
        <Widget type={widget.type} metrics={metrics} />
      </div>
    </div>
  );
}

function AddMenu({ onAdd, onClose }) {
  return (
    <>
      <div className="fixed inset-0 z-30" onClick={onClose} />
      <div className="anim-pop border-border bg-elevated absolute top-full right-0 z-40 mt-1 max-h-80 w-64 overflow-auto rounded-xl border p-1 shadow-lg">
        {WIDGETS.map((w) => (
          <button
            key={w.type}
            type="button"
            onClick={() => onAdd(w.type)}
            className="hover:bg-chip-gray text-primary flex w-full items-center gap-2 rounded-lg px-2.5 py-1.5 text-left text-sm"
          >
            <Plus size={13} className="text-tertiary shrink-0" />
            <span className="truncate">{w.title}</span>
          </button>
        ))}
      </div>
    </>
  );
}

export default DashboardView;
