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

// Las mismas medidas que la tabla de registros (`components/record-table/`).
// La altura de la banda de títulos NO se repite aquí: sale de `--list-head-h`
// vía `.mac-list-head`.
const ROW_H = 32;
const GUTTER = 68;
// La última columna **no lleva ancho**: se estira. Con todas fijas, la banda de
// cabecera terminaba a media lámina y dejaba un escalón de gris hasta el canto.
const COLS = [
  { key: 'title', label: 'Título', width: 280 },
  { key: 'createdBy', label: 'Creado por', width: 200 },
  { key: 'createdAt', label: 'Creación', width: 160 },
  { key: 'updatedAt', label: 'Última actualización' },
];

/** Ancho de una columna como estilo en línea; la última se reparte el resto. */
const colStyle = (c) => (c.width ? { width: c.width, flexShrink: 0 } : { flex: 1, minWidth: 160 });

/**
 * Índice de paneles. Es la **misma lista** que la de registros —bandas alternas,
 * banda de títulos, hueco de selección que solo aparece al pasar el cursor— pero
 * escrita a mano: aquí las columnas son fijas y no hay metadata que consultar,
 * así que no pasa por TanStack Table. Lo que sí comparte son las primitivas de
 * `globals.css`, que es lo que evita que las dos listas se vayan separando.
 * El título se renombra en línea (doble clic) y las filas se reordenan
 * arrastrando. No permite borrar el último panel.
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
      {/* Barra de herramientas: `h-12` y `px-3`, las de `RecordViewBar`. Al
        seleccionar cambian las ACCIONES, no la barra: teñirla entera de naranja
        y animarla hacía saltar el título y desplazaba todo lo de debajo. */}
      <div className="border-border flex h-12 shrink-0 items-center justify-between gap-3 border-b px-3">
        <div className="flex min-w-0 items-center gap-2 pl-1">
          <span className="text-primary truncate text-[13px] font-semibold">Paneles</span>
          <span className="text-tertiary text-xs tabular-nums">{items.length}</span>
        </div>
        <div className="flex shrink-0 items-center gap-1">
          {selected.size > 0 ? (
            <>
              <span className="text-secondary mr-1 text-xs font-medium">
                {selected.size} seleccionados
              </span>
              <Button size="sm" variant="danger" onClick={deleteSelected} disabled={pending}>
                <Trash2 size={14} /> Eliminar
              </Button>
            </>
          ) : (
            <Button size="sm" onClick={create} disabled={pending}>
              <Plus size={14} /> Nuevo panel
            </Button>
          )}
        </div>
      </div>

      <div
        style={{ '--row-h': `${ROW_H}px` }}
        className="mac-list-fill relative flex-1 overflow-auto"
      >
        {/* Banda de títulos: la misma clase, la misma altura y los mismos
          divisores que la cabecera de columnas de la tabla de registros. */}
        <div data-cols className="mac-list-head group/head sticky top-0 z-10 flex w-full">
          <div className="flex shrink-0 items-center gap-0.5 pl-2" style={{ width: GUTTER }}>
            {/* Espaciador del ancho del asa de arrastre para alinear el checkbox
                con los de las filas. */}
            <span aria-hidden className="w-3 shrink-0" />
            <input
              type="checkbox"
              checked={allSelected}
              onChange={toggleAll}
              aria-label="Seleccionar todos"
              className={`size-3.5 ${
                selected.size
                  ? ''
                  : 'opacity-0 group-hover/head:opacity-100 focus-visible:opacity-100'
              }`}
            />
          </div>
          {COLS.map((c) => (
            <div
              key={c.key}
              className="text-secondary flex h-full items-center pr-2 pl-3 text-[11.5px] font-medium select-none"
              style={colStyle(c)}
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
            {items.map((d, i) => (
              <DashboardRow
                key={d.id}
                dashboard={d}
                stripe={i % 2 === 1}
                selectionActive={selected.size > 0}
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

        {/* Fila para crear: sangrada hasta la columna del título, para que el
          «+» caiga justo bajo los avatares y se lea como una fila más. */}
        <button
          type="button"
          onClick={create}
          disabled={pending}
          className="text-tertiary hover:text-primary flex w-full items-center gap-2 text-[13px] hover:bg-[var(--row-hover)] disabled:opacity-50"
          style={{ height: ROW_H, paddingLeft: GUTTER + 12 }}
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
  stripe,
  selected,
  selectionActive,
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
    height: ROW_H,
    zIndex: isDragging ? 20 : undefined,
  };
  const showCheck = selected || selectionActive;

  return (
    <div
      ref={setNodeRef}
      style={style}
      data-stripe={stripe || undefined}
      data-selected={selected || undefined}
      className={`mac-row group relative flex w-full ${isDragging ? 'shadow-lg' : ''}`}
    >
      <div className="flex shrink-0 items-center gap-0.5 pl-2" style={{ width: GUTTER }}>
        <span
          {...attributes}
          {...listeners}
          className="text-tertiary hover:text-secondary flex w-3 shrink-0 cursor-grab justify-center opacity-0 group-hover:opacity-100 active:cursor-grabbing"
          aria-label="Reordenar panel"
        >
          <GripVertical size={13} />
        </span>
        <input
          type="checkbox"
          checked={selected}
          onChange={onToggle}
          aria-label={`Seleccionar ${d.name}`}
          className={`size-3.5 ${showCheck ? '' : 'opacity-0 group-hover:opacity-100 focus-visible:opacity-100'}`}
        />
        <button
          type="button"
          onClick={onOpen}
          className="text-tertiary hover:bg-chip-gray hover:text-primary flex cursor-pointer items-center justify-center rounded-md p-1 opacity-0 transition-colors group-hover:opacity-100"
          aria-label="Abrir panel"
        >
          <Maximize2 size={13} />
        </button>
      </div>

      {/* Título (celda primaria, editable en línea) */}
      {/* Título (celda primaria, editable en línea). Sin animación de subrayado
        ni avatar que crece al pasar por encima: una lista del sistema no se
        mueve al pasarle el cursor, se tiñe la fila y ya. */}
      <div
        onDoubleClick={onStartEdit}
        className={`relative ${editing ? 'ring-accent z-10 rounded-[7px] ring-2 ring-inset' : ''}`}
        style={colStyle(COLS[0])}
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
            className="bg-elevated text-primary h-full w-full rounded-[7px] px-3 text-[13px] outline-none"
            aria-label="Nombre del panel"
          />
        ) : (
          <button
            type="button"
            onClick={onOpen}
            className="flex h-full w-full cursor-pointer items-center gap-2 truncate px-3 text-left"
            title={d.name}
          >
            <Avatar name={d.name} size={19} />
            <span className="text-primary truncate text-[13px]">{d.name}</span>
          </button>
        )}
      </div>

      {/* Creado por */}
      <div
        className="flex h-full items-center gap-2 truncate px-3 text-[13px]"
        style={colStyle(COLS[1])}
      >
        <Avatar name={d.createdBy.name} src={d.createdBy.avatarUrl} size={19} />
        <span className="text-primary truncate">{d.createdBy.name}</span>
      </div>

      {/* Creación */}
      <div
        className="text-secondary flex h-full items-center truncate px-3 text-[13px]"
        style={colStyle(COLS[2])}
      >
        {formatRelative(d.createdAt) || <span className="text-tertiary">—</span>}
      </div>

      {/* Última actualización */}
      <div
        className="text-secondary flex h-full items-center truncate px-3 text-[13px]"
        style={colStyle(COLS[3])}
      >
        {formatRelative(d.updatedAt) || <span className="text-tertiary">—</span>}
      </div>
    </div>
  );
}

export default DashboardList;
