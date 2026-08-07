'use client';

import { useMemo, useRef, useState, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import { useReactTable, getCoreRowModel } from '@tanstack/react-table';
import { useVirtualizer } from '@tanstack/react-virtual';
import { useInfiniteQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  DndContext,
  closestCenter,
  PointerSensor,
  useSensor,
  useSensors,
} from '@dnd-kit/core';
import {
  SortableContext,
  verticalListSortingStrategy,
  useSortable,
  arrayMove,
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { generateKeyBetween } from 'fractional-indexing';
import { toast } from 'sonner';
import { Maximize2, GripVertical } from 'lucide-react';
import { getFieldType } from '@/lib/field-types';
import { readFieldValue } from '@/lib/records/field-path';
import { getFieldComponents } from '@/components/fields/registry';
import {
  listRecordsAction,
  createRecordAction,
  updateRecordAction,
  bulkDeleteAction,
  updateViewAction,
  exportRecordsAction,
  moveRecordAction,
  reorderRecordsAction,
} from '@/app/(workspace)/objects/actions';
import { Toolbar } from './Toolbar';
import { RecordViewBar } from './RecordViewBar';
import { ColumnHeader } from './ColumnHeader';
import { CellContent } from './CellContent';
import { EmptyState } from './EmptyState';
import { ImportDialog } from './ImportDialog';

const ROW_H = 34;
const GUTTER = 76;
const PAGE = 100;

/** Mapea viewFilters/viewSorts (fieldMetadataId) → forma del servicio (fieldName). */
function mapView(view, fieldById) {
  const filters = (view.viewFilters ?? [])
    .map((f) => ({
      fieldName: fieldById[f.fieldMetadataId]?.name,
      operator: f.operator,
      value: f.value,
    }))
    .filter((f) => f.fieldName);
  const sorts = (view.viewSorts ?? [])
    .map((s) => ({ fieldName: fieldById[s.fieldMetadataId]?.name, direction: s.direction }))
    .filter((s) => s.fieldName);
  return { filters, sorts };
}

export function RecordTable({ objectSlug, object, initialView, initialPage, views, activeViewId }) {
  const qc = useQueryClient();
  const router = useRouter();
  const scrollRef = useRef(null);
  const persistTimer = useRef(null);

  const fieldById = useMemo(
    () => Object.fromEntries(object.fields.map((f) => [f.id, f])),
    [object.fields],
  );

  const [view, setView] = useState(initialView);
  const initialMapped = useMemo(() => mapView(initialView, fieldById), [initialView, fieldById]);
  const [filters, setFilters] = useState(initialMapped.filters);
  const [sorts, setSorts] = useState(initialMapped.sorts);

  const queryKey = ['records', objectSlug, filters, sorts];

  // `initialPage` (SSR) solo vale para el estado inicial de la vista. Si se pasa
  // como `initialData` de forma incondicional, react-query lo reaplica a cada
  // queryKey nueva (al ordenar/filtrar) y, con `staleTime`, no vuelve a pedir
  // datos: la tabla se quedaría con el orden original. Por eso solo lo usamos
  // cuando filtros y orden coinciden con los iniciales.
  const isInitialView = useMemo(
    () =>
      JSON.stringify(filters) === JSON.stringify(initialMapped.filters) &&
      JSON.stringify(sorts) === JSON.stringify(initialMapped.sorts),
    [filters, sorts, initialMapped],
  );

  const query = useInfiniteQuery({
    queryKey,
    initialPageParam: undefined,
    queryFn: async ({ pageParam }) => {
      const r = await listRecordsAction({
        objectSlug,
        filters,
        sorts,
        cursor: pageParam,
        limit: PAGE,
      });
      if (!r.ok) throw new Error(r.message);
      return r.data;
    },
    getNextPageParam: (last) => last.nextCursor ?? undefined,
    initialData: isInitialView ? { pages: [initialPage], pageParams: [undefined] } : undefined,
  });

  const rows = useMemo(() => (query.data?.pages ?? []).flatMap((p) => p.records), [query.data]);

  // Columnas desde viewFields (visibles, ordenadas).
  const visibleFields = useMemo(
    () =>
      [...(view.viewFields ?? [])]
        .filter((vf) => vf.isVisible && fieldById[vf.fieldMetadataId])
        .sort((a, b) => a.position - b.position),
    [view, fieldById],
  );

  const columns = useMemo(
    () =>
      visibleFields.map((vf) => {
        const field = fieldById[vf.fieldMetadataId];
        return {
          id: field.name,
          accessorFn: (row) => readFieldValue(row, field),
          size: vf.size ?? 180,
          meta: { field },
        };
      }),
    [visibleFields, fieldById],
  );

  const [columnSizing, setColumnSizing] = useState(
    Object.fromEntries(
      visibleFields.map((vf) => [fieldById[vf.fieldMetadataId].name, vf.size ?? 180]),
    ),
  );

  const table = useReactTable({
    data: rows,
    columns,
    getCoreRowModel: getCoreRowModel(),
    columnResizeMode: 'onChange',
    state: { columnSizing },
    onColumnSizingChange: setColumnSizing,
    getRowId: (row) => row.id,
  });

  const rowVirtualizer = useVirtualizer({
    count: rows.length,
    getScrollElement: () => scrollRef.current,
    estimateSize: () => ROW_H,
    overscan: 12,
  });

  // ---- Persistencia de la vista (debounced) ----
  const persistView = useCallback(
    (patch) => {
      if (persistTimer.current) clearTimeout(persistTimer.current);
      persistTimer.current = setTimeout(() => {
        updateViewAction({ viewId: view.id, patch });
      }, 400);
    },
    [view.id],
  );

  // ---- Selección ----
  const [selected, setSelected] = useState(() => new Set());
  const toggleSelected = (id) =>
    setSelected((s) => {
      const n = new Set(s);
      if (n.has(id)) n.delete(id);
      else n.add(id);
      return n;
    });
  const allSelected = rows.length > 0 && selected.size === rows.length;
  const toggleAll = () => setSelected(allSelected ? new Set() : new Set(rows.map((r) => r.id)));

  const [importOpen, setImportOpen] = useState(false);

  // ---- Celda activa / edición ----
  const [active, setActive] = useState({ row: 0, col: 0 });
  const [editing, setEditing] = useState(false);
  const focusGrid = () => scrollRef.current?.focus();

  const updateM = useMutation({
    mutationFn: async ({ recordId, data }) => {
      const r = await updateRecordAction({ objectSlug, recordId, data });
      if (!r.ok) throw new Error(r.message);
      return r.data;
    },
    onMutate: async ({ recordId, data }) => {
      await qc.cancelQueries({ queryKey });
      const prev = qc.getQueryData(queryKey);
      qc.setQueryData(queryKey, (old) =>
        patchRow(old, recordId, (r) => ({ ...r, data: { ...r.data, ...data } })),
      );
      return { prev };
    },
    onError: (err, _v, ctx) => {
      qc.setQueryData(queryKey, ctx.prev);
      toast.error(err.message || 'No se pudo guardar');
    },
    onSuccess: (serverRow) => {
      qc.setQueryData(queryKey, (old) => patchRow(old, serverRow.id, () => serverRow));
    },
  });

  const createM = useMutation({
    mutationFn: async () => {
      const idField = object.fields.find((f) => f.id === object.labelIdentifierFieldId);
      const data = idField?.type === 'TEXT' ? { [idField.name]: 'Sin título' } : {};
      const r = await createRecordAction({ objectSlug, data });
      if (!r.ok) throw new Error(r.message);
      return r.data;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey });
      toast.success('Registro creado');
    },
    onError: (err) => toast.error(err.message),
  });

  const deleteM = useMutation({
    mutationFn: async (ids) => {
      const r = await bulkDeleteAction({ objectSlug, recordIds: ids });
      if (!r.ok) throw new Error(r.message);
      return r.data;
    },
    onSuccess: () => {
      setSelected(new Set());
      qc.invalidateQueries({ queryKey });
      toast.success('Eliminados');
    },
    onError: (err) => toast.error(err.message),
  });

  function commitCell(recordId, fieldName, value) {
    setEditing(false);
    focusGrid();
    updateM.mutate({ recordId, data: { [fieldName]: value } });
  }

  // ---- Reordenar arrastrando (solo con el orden manual, sin orden de columna) ----
  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 6 } }));
  const sortActive = sorts.length > 0;

  const moveM = useMutation({
    mutationFn: async ({ recordId, position }) => {
      const r = await moveRecordAction({ objectSlug, recordId, position });
      if (!r.ok) throw new Error(r.message);
      return r.data;
    },
    onError: (err) => {
      toast.error(err.message || 'No se pudo reordenar');
      qc.invalidateQueries({ queryKey });
    },
  });

  async function onDragEnd({ active: dragged, over }) {
    if (!over || dragged.id === over.id) return;
    const from = rows.findIndex((r) => r.id === dragged.id);
    const to = rows.findIndex((r) => r.id === over.id);
    if (from < 0 || to < 0) return;
    const moved = arrayMove(rows, from, to);

    // Con un orden de columna activo, arrastrar convierte la vista en orden
    // manual: «hornea» el orden visible actual en `position` y quita el orden.
    if (sortActive) {
      const r = await reorderRecordsAction({ objectSlug, orderedIds: moved.map((x) => x.id) });
      if (!r.ok) return toast.error(r.message || 'No se pudo reordenar');
      const newKey = ['records', objectSlug, filters, []];
      qc.setQueryData(newKey, {
        pages: [{ records: moved, nextCursor: null, hasMore: false }],
        pageParams: [undefined],
      });
      setSorts([]);
      persistView({ viewSorts: [] });
      qc.invalidateQueries({ queryKey: newKey });
      return;
    }

    const prev = moved[to - 1]?.position ?? null;
    const next = moved[to + 1]?.position ?? null;
    let position;
    try {
      position = generateKeyBetween(prev, next);
    } catch {
      position = generateKeyBetween(null, null);
    }
    const reordered = moved.map((r) => (r.id === dragged.id ? { ...r, position } : r));
    qc.setQueryData(queryKey, (old) => rechunkPages(old, reordered));
    moveM.mutate({ recordId: dragged.id, position });
  }

  // ---- Teclado ----
  function onKeyDown(e) {
    if (editing) return;
    const maxRow = rows.length - 1;
    const maxCol = columns.length - 1;
    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setActive((a) => ({ ...a, row: Math.min(maxRow, a.row + 1) }));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setActive((a) => ({ ...a, row: Math.max(0, a.row - 1) }));
    } else if (e.key === 'ArrowRight' || e.key === 'Tab') {
      e.preventDefault();
      setActive((a) => ({ ...a, col: Math.min(maxCol, a.col + 1) }));
    } else if (e.key === 'ArrowLeft') {
      e.preventDefault();
      setActive((a) => ({ ...a, col: Math.max(0, a.col - 1) }));
    } else if (e.key === 'Enter') {
      e.preventDefault();
      setEditing(true);
    }
  }

  // ---- Scroll infinito ----
  function onScroll(e) {
    const el = e.currentTarget;
    if (
      el.scrollHeight - el.scrollTop - el.clientHeight < 400 &&
      query.hasNextPage &&
      !query.isFetchingNextPage
    ) {
      query.fetchNextPage();
    }
  }

  // ---- Cambios de columnas ----
  function updateViewFields(next) {
    const updated = { ...view, viewFields: next };
    setView(updated);
    persistView({ viewFields: next });
  }
  function hideField(fieldMetadataId) {
    updateViewFields(
      view.viewFields.map((vf) =>
        vf.fieldMetadataId === fieldMetadataId ? { ...vf, isVisible: false } : vf,
      ),
    );
  }
  function moveField(fieldMetadataId, dir) {
    const ordered = [...view.viewFields].sort((a, b) => a.position - b.position);
    const idx = ordered.findIndex((vf) => vf.fieldMetadataId === fieldMetadataId);
    const swap = idx + dir;
    if (swap < 0 || swap >= ordered.length) return;
    [ordered[idx], ordered[swap]] = [ordered[swap], ordered[idx]];
    updateViewFields(ordered.map((vf, i) => ({ ...vf, position: i })));
  }
  function toggleSort(fieldName) {
    const cur = sorts[0];
    let next;
    if (!cur || cur.fieldName !== fieldName) next = [{ fieldName, direction: 'asc' }];
    else if (cur.direction === 'asc') next = [{ fieldName, direction: 'desc' }];
    else next = [];
    setSorts(next);
    const field = object.fields.find((f) => f.name === fieldName);
    persistView({
      viewSorts: next.map((s) => ({ fieldMetadataId: field.id, direction: s.direction })),
    });
  }

  function applyFilters(next) {
    setFilters(next);
    const viewFilters = next.map((f) => ({
      fieldMetadataId: object.fields.find((x) => x.name === f.fieldName)?.id,
      operator: f.operator,
      value: f.value,
    }));
    persistView({ viewFilters });
  }

  function csvCell(field, record) {
    const value = readFieldValue(record, field);
    const { toText } = getFieldComponents(field.type);
    const text = toText
      ? toText(value, field)
      : getFieldType(field.type).toSearchText(value, field);
    return `"${String(text ?? '').replace(/"/g, '""')}"`;
  }

  async function exportCsv() {
    const cols = visibleFields.map((vf) => fieldById[vf.fieldMetadataId]);
    let exportRows;
    if (selected.size) {
      exportRows = rows.filter((r) => selected.has(r.id));
    } else {
      // Toda la vista, respetando filtros y orden (desde el servidor).
      const r = await exportRecordsAction({ objectSlug, filters, sorts });
      exportRows = r.ok ? r.data.records : rows;
    }
    const header = cols.map((f) => f.label).join(',');
    const lines = exportRows.map((r) => cols.map((f) => csvCell(f, r)).join(','));
    const blob = new Blob([[header, ...lines].join('\n')], { type: 'text/csv' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = `${objectSlug}.csv`;
    a.click();
  }

  const totalWidth = table.getTotalSize();
  const sortDir = (name) => (sorts[0]?.fieldName === name ? sorts[0].direction : null);

  return (
    <div className="flex h-full flex-col">
      <RecordViewBar
        objectSlug={objectSlug}
        views={views}
        activeViewId={activeViewId}
        count={rows.length}
      >
        <Toolbar
          selectedCount={selected.size}
          fields={object.fields}
          filters={filters}
          onFiltersChange={applyFilters}
          onNewRecord={() => createM.mutate()}
          onDeleteSelected={() => deleteM.mutate([...selected])}
          onExport={exportCsv}
          onImport={() => setImportOpen(true)}
        />
      </RecordViewBar>

      <ImportDialog
        open={importOpen}
        onOpenChange={setImportOpen}
        objectSlug={objectSlug}
        fields={object.fields}
        onImported={() => qc.invalidateQueries({ queryKey })}
      />

      {rows.length === 0 && !query.isFetching ? (
        <EmptyState label={object.labelPlural} onCreate={() => createM.mutate()} />
      ) : (
        <div
          ref={scrollRef}
          tabIndex={0}
          onKeyDown={onKeyDown}
          onScroll={onScroll}
          className="relative flex-1 overflow-auto outline-none"
        >
          {/* Cabecera */}
          <div
            className="border-border bg-surface sticky top-0 z-10 flex border-b"
            style={{ width: totalWidth + GUTTER }}
          >
            <div className="flex shrink-0 items-center justify-center" style={{ width: GUTTER }}>
              <input
                type="checkbox"
                checked={allSelected}
                onChange={toggleAll}
                className="accent-accent size-3.5"
              />
            </div>
            {table.getFlatHeaders().map((header) => {
              const field = header.column.columnDef.meta.field;
              return (
                <div
                  key={header.id}
                  className="border-border shrink-0 border-l"
                  style={{ width: header.getSize() }}
                >
                  <ColumnHeader
                    label={field.label}
                    sortDir={sortDir(field.name)}
                    onSort={() => toggleSort(field.name)}
                    onHide={() => hideField(field.id)}
                    onMoveLeft={() => moveField(field.id, -1)}
                    onMoveRight={() => moveField(field.id, 1)}
                    onResizeStart={header.getResizeHandler()}
                  />
                </div>
              );
            })}
          </div>

          {/* Cuerpo virtualizado (filas ordenables por arrastre) */}
          <DndContext sensors={sensors} collisionDetection={closestCenter} onDragEnd={onDragEnd}>
            <SortableContext items={rows.map((r) => r.id)} strategy={verticalListSortingStrategy}>
              <div
                style={{
                  height: rowVirtualizer.getTotalSize(),
                  width: totalWidth + GUTTER,
                  position: 'relative',
                }}
              >
                {rowVirtualizer.getVirtualItems().map((vItem) => {
                  const row = table.getRowModel().rows[vItem.index];
                  const record = row.original;
                  return (
                    <RecordRow
                      key={row.id}
                      record={record}
                      cells={row.getVisibleCells()}
                      top={vItem.start}
                      width={totalWidth + GUTTER}
                      dragEnabled
                      isActiveRow={active.row === vItem.index}
                      activeCol={active.col}
                      editing={editing}
                      selected={selected.has(record.id)}
                      onToggleSelected={() => toggleSelected(record.id)}
                      onOpen={() => router.push(`/objects/${objectSlug}/${record.id}`)}
                      onActivateCell={(colIndex) => setActive({ row: vItem.index, col: colIndex })}
                      onStartEdit={() => setEditing(true)}
                      onCommitCell={(field, v) => commitCell(record.id, field.name, v)}
                      onCancelEdit={() => {
                        setEditing(false);
                        focusGrid();
                      }}
                    />
                  );
                })}
              </div>
            </SortableContext>
          </DndContext>
        </div>
      )}
    </div>
  );
}

/** Aplica una transformación a un registro en las páginas cacheadas. */
function patchRow(old, recordId, fn) {
  if (!old) return old;
  return {
    ...old,
    pages: old.pages.map((p) => ({
      ...p,
      records: p.records.map((r) => (r.id === recordId ? fn(r) : r)),
    })),
  };
}

/**
 * Reparte una lista plana de registros (ya reordenada) en las páginas cacheadas
 * conservando sus tamaños, para actualizar el orden de forma optimista sin
 * romper la paginación por cursor.
 */
function rechunkPages(old, flatRows) {
  if (!old) return old;
  let i = 0;
  const pages = old.pages.map((p) => {
    const records = flatRows.slice(i, i + p.records.length);
    i += p.records.length;
    return { ...p, records };
  });
  return { ...old, pages };
}

/**
 * Fila de la tabla, arrastrable (dnd-kit). Se extrae en su propio componente
 * porque el cuerpo está virtualizado y `useSortable` es un hook (no puede
 * llamarse dentro del `.map` de los elementos virtuales).
 */
function RecordRow({
  record,
  cells,
  top,
  width,
  dragEnabled,
  isActiveRow,
  activeCol,
  editing,
  selected,
  onToggleSelected,
  onOpen,
  onActivateCell,
  onStartEdit,
  onCommitCell,
  onCancelEdit,
}) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: record.id,
    disabled: !dragEnabled,
  });
  const style = {
    top,
    height: ROW_H,
    width,
    transform: CSS.Translate.toString(transform),
    transition,
    zIndex: isDragging ? 20 : undefined,
    opacity: isDragging ? 0.9 : 1,
  };

  return (
    <div
      ref={setNodeRef}
      style={style}
      data-testid="record-row"
      className={`group border-border hover:bg-chip-gray/40 absolute left-0 flex border-b transition-colors ${
        isDragging ? 'bg-surface shadow-md' : ''
      }`}
    >
      <div className="flex shrink-0 items-center gap-1 pl-2" style={{ width: GUTTER }}>
        {dragEnabled && (
          <span
            {...attributes}
            {...listeners}
            className="text-tertiary hover:text-secondary cursor-grab opacity-0 group-hover:opacity-100 active:cursor-grabbing"
            aria-label="Reordenar registro"
          >
            <GripVertical size={14} />
          </span>
        )}
        <input
          type="checkbox"
          checked={selected}
          onChange={onToggleSelected}
          className="accent-accent size-3.5"
        />
        <button
          type="button"
          onClick={onOpen}
          className="text-tertiary hover:bg-chip-gray hover:text-primary flex cursor-pointer items-center justify-center rounded-md p-1.5 opacity-0 transition-colors group-hover:opacity-100"
          aria-label="Abrir registro"
        >
          <Maximize2 size={13} />
        </button>
      </div>
      {cells.map((cell, colIndex) => {
        const field = cell.column.columnDef.meta.field;
        const isActiveCell = isActiveRow && activeCol === colIndex;
        return (
          <div
            key={cell.id}
            onMouseDown={() => onActivateCell(colIndex)}
            onDoubleClick={onStartEdit}
            className={`border-border shrink-0 overflow-visible border-l ${isActiveCell ? 'ring-accent relative z-10 ring-2 ring-inset' : ''}`}
            style={{ width: cell.column.getSize(), height: ROW_H }}
          >
            <CellContent
              field={field}
              value={readFieldValue(record, field)}
              relation={record.relations?.[field.name]}
              editing={isActiveCell && editing}
              isPrimary={colIndex === 0}
              onCommit={(v) => onCommitCell(field, v)}
              onCancel={onCancelEdit}
            />
          </div>
        );
      })}
    </div>
  );
}

export default RecordTable;
