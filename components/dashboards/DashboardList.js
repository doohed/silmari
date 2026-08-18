'use client';

import { useRef, useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { DndContext, closestCenter, PointerSensor, useSensor, useSensors } from '@dnd-kit/core';
import {
  SortableContext,
  verticalListSortingStrategy,
  useSortable,
  arrayMove,
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { generateKeyBetween } from 'fractional-indexing';
import { Plus, Maximize2, Trash2, GripVertical } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/Button';
import { Avatar } from '@/components/ui/Avatar';
import { formatRelative } from '@/lib/utils/relative-time';
import {
  createDashboardAction,
  renameDashboardAction,
  deleteDashboardAction,
  reorderDashboardAction,
} from '@/app/(workspace)/dashboards/actions';

// Rejilla de la tabla, con las mismas medidas que la tabla de registros.
const ROW_H = 34;
const GUTTER = 76;
const COLS = [
  { key: 'title', label: 'Título', width: 260 },
  { key: 'createdBy', label: 'Creado por', width: 200 },
  { key: 'createdAt', label: 'Creación', width: 180 },
  { key: 'updatedAt', label: 'Última actualización', width: 200 },
];
const TOTAL_WIDTH = GUTTER + COLS.reduce((s, c) => s + c.width, 0);

/**
 * Índice de paneles con la misma estética que la tabla de registros
 * (`/objects/[slug]`): gutter con selección, arrastre y «abrir»; celdas con
 * borde y celda primaria con avatar. El título se renombra en línea (doble clic)
 * y las filas se reordenan arrastrando. No permite borrar el último panel.
 * @param {{ dashboards: Array<{
 *   id:string, name:string, position:string|null,
 *   createdBy:{ name:string, avatarUrl:string|null },
 *   createdAt:string|null, updatedAt:string|null,
 * }> }} props
 */
export function DashboardList({ dashboards }) {
  const router = useRouter();
  const [editingId, setEditingId] = useState(null);
  const [selected, setSelected] = useState(() => new Set());
  const [pending, startTransition] = useTransition();
  const renameRef = useRef(null);

  // Orden local optimista. Se re-sincroniza cuando cambian los datos del
  // servidor (crear/renombrar/borrar); un reordenamiento no cambia ids ni
  // nombres, así que conserva el orden ya aplicado. Patrón de «ajustar estado
  // al cambiar props» (con estado, no refs) de la doc de React.
  const [items, setItems] = useState(dashboards);
  const sig = dashboards.map((d) => `${d.id}:${d.name}`).join('|');
  const [prevSig, setPrevSig] = useState(sig);
  if (prevSig !== sig) {
    setPrevSig(sig);
    setItems(dashboards);
  }

  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 5 } }));

  const open = (id) => router.push(`/dashboards/${id}`);

  const allSelected = items.length > 0 && selected.size === items.length;
  const toggleAll = () => setSelected(allSelected ? new Set() : new Set(items.map((d) => d.id)));
  const toggleOne = (id) =>
    setSelected((s) => {
      const n = new Set(s);
      if (n.has(id)) n.delete(id);
      else n.add(id);
      return n;
    });

  const create = () =>
    startTransition(async () => {
      const r = await createDashboardAction({ name: `Panel ${items.length + 1}` });
      if (!r.ok) return toast.error(r.message || 'No se pudo crear el panel');
      setEditingId(r.data.id);
      router.refresh();
    });

  const submitRename = (id, current) => {
    const next = (renameRef.current?.value ?? '').trim();
    setEditingId(null);
    if (!next || next === current) return;
    startTransition(async () => {
      const r = await renameDashboardAction({ id, name: next });
      if (!r.ok) return toast.error(r.message || 'No se pudo renombrar');
      router.refresh();
    });
  };

  const deleteSelected = () =>
    startTransition(async () => {
      let failed = null;
      for (const id of selected) {
        const r = await deleteDashboardAction({ id });
        if (!r.ok) {
          failed = r.message;
          break;
        }
      }
      setSelected(new Set());
      if (failed) toast.error(failed);
      router.refresh();
    });

  function onDragEnd({ active, over }) {
    if (!over || active.id === over.id) return;
    const from = items.findIndex((d) => d.id === active.id);
    const to = items.findIndex((d) => d.id === over.id);
    if (from < 0 || to < 0) return;
    const next = arrayMove(items, from, to);

    const prev = next[to - 1]?.position ?? null;
    const after = next[to + 1]?.position ?? null;
    let position;
    try {
      position = generateKeyBetween(prev, after);
    } catch {
      position = generateKeyBetween(null, null);
    }
    next[to] = { ...next[to], position };
    setItems(next);

    startTransition(async () => {
      const r = await reorderDashboardAction({ id: active.id, position });
      if (!r.ok) {
        toast.error(r.message || 'No se pudo reordenar');
        router.refresh();
      }
    });
  }

  return (
    <div className="flex h-full flex-col">
      {selected.size > 0 ? (
        <div className="border-border bg-accent-subtle anim-fade-up flex h-12 shrink-0 items-center gap-3 border-b px-5">
          <span className="text-primary text-sm font-medium">{selected.size} seleccionados</span>
          <Button size="sm" variant="danger" onClick={deleteSelected} disabled={pending}>
            <Trash2 size={14} /> Eliminar
          </Button>
        </div>
      ) : (
        <div className="border-border flex h-12 shrink-0 items-center justify-between border-b px-5">
          <div className="flex items-center gap-2">
            <span className="text-primary text-sm font-medium">Paneles</span>
            <span className="text-tertiary text-xs">{items.length}</span>
          </div>
          <Button size="sm" onClick={create} disabled={pending}>
            <Plus size={14} /> Nuevo panel
          </Button>
        </div>
      )}

      <div className="relative flex-1 overflow-auto">
        {/* Cabecera */}
        <div
          className="border-border bg-surface sticky top-0 z-10 flex border-b"
          style={{ width: TOTAL_WIDTH }}
        >
          <div className="flex shrink-0 items-center gap-1 pl-2" style={{ width: GUTTER }}>
            {/* Espaciador del ancho del asa de arrastre para alinear el checkbox
                con los de las filas. */}
            <span aria-hidden className="w-3.5 shrink-0" />
            <input
              type="checkbox"
              checked={allSelected}
              onChange={toggleAll}
              className="accent-accent size-3.5"
              aria-label="Seleccionar todos"
            />
          </div>
          {COLS.map((c) => (
            <div
              key={c.key}
              className="border-border text-tertiary flex h-9 shrink-0 items-center border-l pr-1 pl-2 text-xs font-medium tracking-wide uppercase select-none"
              style={{ width: c.width }}
            >
              <span className="truncate">{c.label}</span>
            </div>
          ))}
        </div>

        {/* Filas ordenables */}
        <DndContext
          id="dashboard-list-dnd"
          sensors={sensors}
          collisionDetection={closestCenter}
          onDragEnd={onDragEnd}
        >
          <SortableContext items={items.map((d) => d.id)} strategy={verticalListSortingStrategy}>
            {items.map((d) => (
              <DashboardRow
                key={d.id}
                dashboard={d}
                selected={selected.has(d.id)}
                onToggle={() => toggleOne(d.id)}
                onOpen={() => open(d.id)}
                editing={editingId === d.id}
                onStartEdit={() => setEditingId(d.id)}
                renameRef={editingId === d.id ? renameRef : null}
                onSubmit={() => submitRename(d.id, d.name)}
                onCancel={() => setEditingId(null)}
                pending={pending}
              />
            ))}
          </SortableContext>
        </DndContext>

        {/* Fila para crear */}
        <button
          type="button"
          onClick={create}
          disabled={pending}
          className="text-tertiary hover:bg-chip-gray/40 hover:text-primary flex items-center gap-2 border-b border-transparent pl-4 text-sm disabled:opacity-50"
          style={{ width: TOTAL_WIDTH, height: ROW_H }}
        >
          <Plus size={14} /> Añadir panel
        </button>
      </div>
    </div>
  );
}

/** Una fila arrastrable de la tabla de paneles. */
function DashboardRow({
  dashboard: d,
  selected,
  onToggle,
  onOpen,
  editing,
  onStartEdit,
  renameRef,
  onSubmit,
  onCancel,
  pending,
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: d.id,
  });
  const style = {
    transform: CSS.Translate.toString(transform),
    transition,
    width: TOTAL_WIDTH,
    height: ROW_H,
    zIndex: isDragging ? 20 : undefined,
    opacity: isDragging ? 0.9 : 1,
  };

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={`group border-border hover:bg-chip-gray/40 relative flex border-b transition-colors ${
        isDragging ? 'bg-surface shadow-md' : ''
      }`}
    >
      <div className="flex shrink-0 items-center gap-1 pl-2" style={{ width: GUTTER }}>
        <span
          {...attributes}
          {...listeners}
          className="text-tertiary hover:text-secondary cursor-grab opacity-0 group-hover:opacity-100 active:cursor-grabbing"
          aria-label="Reordenar panel"
        >
          <GripVertical size={14} />
        </span>
        <input
          type="checkbox"
          checked={selected}
          onChange={onToggle}
          className="accent-accent size-3.5"
          aria-label={`Seleccionar ${d.name}`}
        />
        <button
          type="button"
          onClick={onOpen}
          className="text-tertiary hover:bg-chip-gray hover:text-primary flex cursor-pointer items-center justify-center rounded-md p-1.5 opacity-0 transition-colors group-hover:opacity-100"
          aria-label="Abrir panel"
        >
          <Maximize2 size={13} />
        </button>
      </div>

      {/* Título (celda primaria, editable en línea) */}
      <div
        onDoubleClick={onStartEdit}
        className={`border-border shrink-0 border-l ${
          editing ? 'ring-accent relative z-10 ring-2 ring-inset' : ''
        }`}
        style={{ width: COLS[0].width, height: ROW_H }}
      >
        {editing ? (
          <input
            ref={renameRef}
            defaultValue={d.name}
            autoFocus
            maxLength={60}
            disabled={pending}
            onBlur={onSubmit}
            onKeyDown={(e) => {
              if (e.key === 'Enter') onSubmit();
              if (e.key === 'Escape') onCancel();
            }}
            className="bg-surface text-primary h-full w-full px-3 text-sm outline-none"
            aria-label="Nombre del panel"
          />
        ) : (
          <button
            type="button"
            onClick={onOpen}
            className="group/title flex h-full w-full cursor-pointer items-center gap-2.5 truncate px-3 text-left"
            title={d.name}
          >
            <Avatar
              name={d.name}
              size={20}
              className="transition-transform duration-200 group-hover/title:scale-110"
            />
            <span className="text-primary group-hover/title:text-accent relative truncate text-sm font-medium transition-colors duration-200 after:absolute after:-bottom-0.5 after:left-0 after:h-px after:w-full after:origin-left after:scale-x-0 after:bg-current after:transition-transform after:duration-200 group-hover/title:after:scale-x-100">
              {d.name}
            </span>
          </button>
        )}
      </div>

      {/* Creado por */}
      <div
        className="border-border shrink-0 border-l"
        style={{ width: COLS[1].width, height: ROW_H }}
      >
        <div className="flex h-full w-full items-center gap-1.5 truncate px-3 text-sm">
          <Avatar name={d.createdBy.name} src={d.createdBy.avatarUrl} size={18} />
          <span className="text-primary truncate">{d.createdBy.name}</span>
        </div>
      </div>

      {/* Creación */}
      <div
        className="border-border shrink-0 border-l"
        style={{ width: COLS[2].width, height: ROW_H }}
      >
        <div className="text-secondary flex h-full w-full items-center truncate px-3 text-sm">
          {formatRelative(d.createdAt) || <span className="text-tertiary">—</span>}
        </div>
      </div>

      {/* Última actualización */}
      <div
        className="border-border shrink-0 border-l"
        style={{ width: COLS[3].width, height: ROW_H }}
      >
        <div className="text-secondary flex h-full w-full items-center truncate px-3 text-sm">
          {formatRelative(d.updatedAt) || <span className="text-tertiary">—</span>}
        </div>
      </div>
    </div>
  );
}

export default DashboardList;
