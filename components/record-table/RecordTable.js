'use client';

import { useMemo, useRef, useState, useCallback } from 'react';
import { useReactTable, getCoreRowModel } from '@tanstack/react-table';
import { useVirtualizer } from '@tanstack/react-virtual';
import { useInfiniteQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { DndContext, closestCenter, PointerSensor, useSensor, useSensors } from '@dnd-kit/core';
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
import { getFieldType, isSortableField } from '@/lib/field-types';
import { readFieldValue } from '@/lib/records/field-path';
import { toCsv } from '@/lib/records/csv';
import { getFieldComponents } from '@/components/fields/registry';
import {
  listRecordsAction,
  createRecordAction,
  updateRecordAction,
  bulkDeleteAction,
  bulkUpdateAction,
  updateViewAction,
  exportRecordsAction,
  moveRecordAction,
  reorderRecordsAction,
} from '@/app/(workspace)/objects/actions';
import { Toolbar } from './Toolbar';
import { RecordViewBar } from './RecordViewBar';
import { ColumnHeader } from './ColumnHeader';
import { CellContent, fieldAlign } from './CellContent';
import { EmptyState } from './EmptyState';
import { ImportDialog } from './ImportDialog';
import { RecordCards } from './RecordCards';
import { RecordDrawer } from '@/components/record-detail/RecordDrawer';

// La altura de la fila va aquí porque el virtualizador mide en JS. La de la
// banda de títulos **no**: vive en `--list-head-h` (`globals.css`), que es lo
// que la mantiene idéntica a la fila de pestañas de la ficha de al lado.
const ROW_H = 32;
const GUTTER = 68;
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
  // Una vista guardada puede arrastrar un orden por un campo que la BD no sabe
  // ordenar (se guardó antes de que existiera la comprobación). Se descarta
  // aquí en vez de dejar que el servicio conteste con un error de validación y
  // la tabla se quede en blanco.
  const sorts = (view.viewSorts ?? [])
    .map((s) => ({ field: fieldById[s.fieldMetadataId], direction: s.direction }))
    .filter((s) => s.field && isSortableField(s.field))
    .map((s) => ({ fieldName: s.field.name, direction: s.direction }));
  return { filters, sorts };
}

export function RecordTable({ objectSlug, object, initialView, initialPage, views, activeViewId }) {
  const qc = useQueryClient();
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

  // Nombres de los campos visibles (ordenados y únicos): la tabla solo pide al
  // servidor esas columnas (proyección). Reordenar columnas no cambia el set
  // (misma clave → sin refetch); ocultar/mostrar sí.
  const visibleFieldNames = useMemo(
    () =>
      [
        ...new Set(
          [...(view.viewFields ?? [])]
            .filter((vf) => vf.isVisible && fieldById[vf.fieldMetadataId])
            .map((vf) => fieldById[vf.fieldMetadataId].name),
        ),
      ].sort(),
    [view, fieldById],
  );

  const queryKey = ['records', objectSlug, filters, sorts, visibleFieldNames];

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
        fieldNames: visibleFieldNames,
      });
      if (!r.ok) throw new Error(r.message);
      return r.data;
    },
    getNextPageParam: (last) => last.nextCursor ?? undefined,
    initialData: isInitialView ? { pages: [initialPage], pageParams: [undefined] } : undefined,
  });

  const rows = useMemo(() => (query.data?.pages ?? []).flatMap((p) => p.records), [query.data]);

  // El recuento de la barra es el TOTAL de la vista, que viaja en la primera
  // página. Antes se pasaba `rows.length`, así que el número subía de 100 a 200
  // a 300 según se hacía scroll: no contaba registros, contaba lo descargado.
  const total = query.data?.pages?.[0]?.total ?? null;

  // Columnas desde viewFields (visibles, ordenadas).
  const visibleFields = useMemo(
    () =>
      [...(view.viewFields ?? [])]
        .filter((vf) => vf.isVisible && fieldById[vf.fieldMetadataId])
        .sort((a, b) => a.position - b.position),
    [view, fieldById],
  );

  /** Metadata de las columnas visibles, en orden. La comparten las tarjetas de
   * móvil y la exportación a CSV. */
  const visibleFieldMeta = useMemo(
    () => visibleFields.map((vf) => fieldById[vf.fieldMetadataId]),
    [visibleFields, fieldById],
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
  // Registro abierto en el panel lateral (cajón); null = cerrado.
  const [openRecordId, setOpenRecordId] = useState(null);

  // ---- Celda activa / edición ----
  // `-1` = todavía no hay celda elegida. Arrancar en {0,0} pintaba el anillo
  // naranja sobre la primera celda nada más abrir la página, como si el usuario
  // hubiera hecho algo; en una NSTableView no hay selección hasta que la hay.
  const [active, setActive] = useState({ row: -1, col: -1 });
  const [editing, setEditing] = useState(false);
  // El anillo de celda activa solo se pinta con la rejilla enfocada, como la
  // selección de una NSTableView: sin esto, al abrir la página la primera celda
  // aparecía rodeada de naranja sin que nadie hubiera tocado nada.
  const [gridFocused, setGridFocused] = useState(false);
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

  const updateManyM = useMutation({
    mutationFn: async ({ fieldName, value }) => {
      const r = await bulkUpdateAction({
        objectSlug,
        recordIds: [...selected],
        fieldName,
        value,
      });
      if (!r.ok) throw new Error(r.message);
      return r.data;
    },
    onSuccess: (data) => {
      setSelected(new Set());
      qc.invalidateQueries({ queryKey });
      toast.success(`${data.updated} actualizados`);
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
      const newKey = ['records', objectSlug, filters, [], visibleFieldNames];
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
  const NAV_KEYS = ['ArrowDown', 'ArrowUp', 'ArrowRight', 'ArrowLeft', 'Tab', 'Enter'];

  function onKeyDown(e) {
    if (editing) return;
    const maxRow = rows.length - 1;
    const maxCol = columns.length - 1;
    // Primera tecla de navegación sin celda elegida: entra por la de arriba a
    // la izquierda en vez de mover desde una posición que no existe.
    if (active.row < 0 && NAV_KEYS.includes(e.key)) {
      e.preventDefault();
      setActive({ row: 0, col: 0 });
      return;
    }
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
    // Atributo en el DOM y no estado: esto se dispara en cada frame de scroll y
    // un `setState` por frame re-renderizaría la lista entera.
    el.dataset.scrolledX = el.scrollLeft > 0;
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

  /** Texto plano de una celda para el CSV (el escapado lo pone `toCsv`). */
  function cellText(field, record) {
    const value = readFieldValue(record, field);
    const { toText } = getFieldComponents(field.type);
    return toText ? toText(value, field) : getFieldType(field.type).toSearchText(value, field);
  }

  async function exportCsv() {
    const cols = visibleFieldMeta;
    let exportRows;
    if (selected.size) {
      exportRows = rows.filter((r) => selected.has(r.id));
    } else {
      // Toda la vista, respetando filtros y orden (desde el servidor).
      const r = await exportRecordsAction({ objectSlug, filters, sorts });
      exportRows = r.ok ? r.data.records : rows;
    }
    const csv = toCsv(
      cols.map((f) => f.label),
      exportRows.map((r) => cols.map((f) => cellText(f, r))),
    );
    const blob = new Blob([csv], { type: 'text/csv' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = `${objectSlug}.csv`;
    a.click();
  }

  const totalWidth = table.getTotalSize();
  const sortDir = (name) => (sorts[0]?.fieldName === name ? sorts[0].direction : null);

  return (
    <div className="flex h-full">
      <div className="flex h-full min-w-0 flex-1 flex-col">
        <RecordViewBar
          objectSlug={objectSlug}
          views={views}
          activeViewId={activeViewId}
          count={total}
        >
          <Toolbar
            selectedCount={selected.size}
            fields={object.fields}
            filters={filters}
            onFiltersChange={applyFilters}
            onNewRecord={() => createM.mutate()}
            onDeleteSelected={() => deleteM.mutate([...selected])}
            onEditSelected={(fieldName, value) => updateManyM.mutate({ fieldName, value })}
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
            onFocus={() => setGridFocused(true)}
            onBlur={() => setGridFocused(false)}
            style={{ '--row-h': `${ROW_H}px` }}
            className="mac-list-fill relative flex-1 overflow-auto outline-none"
          >
            {/* Móvil: tarjetas. La tabla necesita scroll horizontal y ahí no se
              puede usar. Se alternan por CSS y no midiendo el ancho en JS, que
              provocaría un salto visible tras la hidratación. */}
            <div className="md:hidden">
              <RecordCards
                rows={rows}
                fields={visibleFieldMeta}
                primaryFieldId={object.labelIdentifierFieldId}
                onOpen={setOpenRecordId}
              />
            </div>

            {/* Cabecera (z-30 para que el menú de columna quede sobre las filas).
              La primera columna viaja congelada con el hueco de selección: al
              desplazarse en horizontal el identificador del registro sigue a la
              vista, como la columna de cabecera de Numbers. */}
            <div
              data-cols
              className="mac-list-head group/head sticky top-0 z-30 hidden md:flex"
              style={{ width: totalWidth + GUTTER }}
            >
              <div
                className="mac-freeze flex shrink-0 items-center gap-0.5 pl-2"
                style={{ width: GUTTER }}
              >
                {/* Espaciador del ancho del asa de arrastre para alinear el
                  checkbox con los de las filas. */}
                <span aria-hidden className="w-3 shrink-0" />
                <input
                  type="checkbox"
                  checked={allSelected}
                  onChange={toggleAll}
                  aria-label="Seleccionar todo"
                  className={`size-3.5 ${
                    selected.size
                      ? ''
                      : 'opacity-0 group-hover/head:opacity-100 focus-visible:opacity-100'
                  }`}
                />
              </div>
              {table.getFlatHeaders().map((header, i) => {
                const field = header.column.columnDef.meta.field;
                return (
                  <div
                    key={header.id}
                    className={i === 0 ? 'mac-freeze mac-freeze-edge shrink-0' : 'shrink-0'}
                    style={{ width: header.getSize(), ...(i === 0 ? { left: GUTTER } : null) }}
                  >
                    <ColumnHeader
                      label={field.label}
                      sortDir={sortDir(field.name)}
                      align={fieldAlign(field)}
                      sortable={isSortableField(field)}
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
            <DndContext
              id="record-table-dnd"
              sensors={sensors}
              collisionDetection={closestCenter}
              onDragEnd={onDragEnd}
            >
              <SortableContext items={rows.map((r) => r.id)} strategy={verticalListSortingStrategy}>
                <div
                  className="hidden md:block"
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
                        stripe={vItem.index % 2 === 1}
                        dragEnabled
                        isActiveRow={active.row === vItem.index}
                        activeCol={active.col}
                        showRing={gridFocused}
                        editing={editing}
                        selected={selected.has(record.id)}
                        selectionActive={selected.size > 0}
                        onToggleSelected={() => toggleSelected(record.id)}
                        onOpen={() => setOpenRecordId(record.id)}
                        onActivateCell={(colIndex) =>
                          setActive({ row: vItem.index, col: colIndex })
                        }
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

      <RecordDrawer
        open={openRecordId != null}
        objectSlug={objectSlug}
        object={object}
        recordId={openRecordId}
        onClose={() => setOpenRecordId(null)}
        onChanged={() => qc.invalidateQueries({ queryKey: ['records', objectSlug] })}
      />
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
 * Clases de estado de una celda. Editando y anillo son **excluyentes**: el
 * editor ya trae su propio anillo, y dejar los dos `z-*` en el className los
 * hacía competir (el orden lo decidía la hoja de estilos, no el marcado).
 * Editando sube a `z-20` para que un desplegable no quede tapado por las filas
 * de abajo, que van después en el DOM.
 */
function cellStateClass(isActiveCell, editing, showRing) {
  if (!isActiveCell) return '';
  if (editing) return 'z-20';
  return showRing ? 'ring-accent z-[2] rounded-[7px] ring-2 ring-inset' : '';
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
  stripe,
  dragEnabled,
  isActiveRow,
  activeCol,
  showRing,
  editing,
  selected,
  selectionActive,
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
  };

  // El checkbox se esconde mientras no haya nada que seleccionar: una columna
  // de casillas siempre visible es lo que delata un formulario web. Reaparece
  // al pasar el cursor y se queda fija en cuanto hay una selección viva.
  const showCheck = selected || selectionActive;

  return (
    <div
      ref={setNodeRef}
      style={style}
      data-testid="record-row"
      data-stripe={stripe || undefined}
      data-selected={selected || undefined}
      className={`mac-row group absolute left-0 flex ${isDragging ? 'shadow-lg' : ''}`}
    >
      <div className="mac-freeze flex shrink-0 items-center gap-0.5 pl-2" style={{ width: GUTTER }}>
        {dragEnabled && (
          <span
            {...attributes}
            {...listeners}
            className="text-tertiary hover:text-secondary flex w-3 shrink-0 cursor-grab justify-center opacity-0 group-hover:opacity-100 active:cursor-grabbing"
            aria-label="Reordenar registro"
          >
            <GripVertical size={13} />
          </span>
        )}
        <input
          type="checkbox"
          checked={selected}
          onChange={onToggleSelected}
          aria-label="Seleccionar registro"
          className={`size-3.5 ${showCheck ? '' : 'opacity-0 group-hover:opacity-100 focus-visible:opacity-100'}`}
        />
        <button
          type="button"
          onClick={onOpen}
          className="text-tertiary hover:bg-chip-gray hover:text-primary flex cursor-pointer items-center justify-center rounded-md p-1 opacity-0 transition-colors group-hover:opacity-100"
          aria-label="Abrir registro"
        >
          <Maximize2 size={13} />
        </button>
      </div>
      {cells.map((cell, colIndex) => {
        const field = cell.column.columnDef.meta.field;
        const isActiveCell = isActiveRow && activeCol === colIndex;
        const frozen = colIndex === 0;
        return (
          <div
            key={cell.id}
            onMouseDown={() => onActivateCell(colIndex)}
            onDoubleClick={onStartEdit}
            /* `relative` SIEMPRE, no solo con el anillo: los editores que abren
              un desplegable (SELECT, MULTI_SELECT) se posicionan con
              `absolute top-full` y buscan el ancestro posicionado más cercano.
              Si la celda no lo era, ese ancestro pasaba a ser la FILA (que sí
              es `absolute`), y el menú aparecía pegado al borde izquierdo de la
              tabla en vez de bajo la celda. Salía bien la primera vez —cuando
              la celda llevaba el anillo y con él el `relative`— y mal en
              cuanto se movía a otro registro. */
            className={`relative shrink-0 overflow-visible ${
              frozen ? 'mac-freeze mac-freeze-edge' : ''
            } ${cellStateClass(isActiveCell, editing, showRing)}`}
            style={{
              width: cell.column.getSize(),
              height: ROW_H,
              ...(frozen ? { left: GUTTER } : null),
            }}
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
