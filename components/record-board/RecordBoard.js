'use client';

import { useEffect, useMemo, useState } from 'react';
import {
  DndContext,
  closestCorners,
  PointerSensor,
  KeyboardSensor,
  useSensor,
  useSensors,
} from '@dnd-kit/core';
import { sortableKeyboardCoordinates } from '@dnd-kit/sortable';
import { generateKeyBetween } from 'fractional-indexing';
import { toast } from 'sonner';
import { formatCurrency, formatNumber } from '@/lib/utils/format';
import { useWorkspaceSettings } from '@/components/providers/WorkspaceProvider';
import {
  listBoardColumnAction,
  columnAggregatesAction,
  moveRecordAction,
} from '@/app/(workspace)/objects/actions';
import { BoardColumn } from './BoardColumn';
import { RecordViewBar } from '@/components/record-table/RecordViewBar';

const NONE = '__none__';

export function RecordBoard({ objectSlug, object, view, views, activeViewId }) {
  const { currency } = useWorkspaceSettings();
  const groupField = object.fields.find((f) => f.id === view.kanbanFieldMetadataId);
  const titleField = object.fields.find((f) => f.id === object.labelIdentifierFieldId);
  const sumField = object.fields.find((f) => ['CURRENCY', 'NUMBER'].includes(f.type));

  const cols = useMemo(() => {
    const options = [...(groupField?.options ?? [])].sort((a, b) => a.position - b.position);
    return [
      ...options.map((o) => ({ key: o.value, value: o.value, label: o.label, color: o.color })),
      { key: NONE, value: null, label: 'Sin asignar', color: 'gray' },
    ];
  }, [groupField]);

  const bodyFields = useMemo(() => {
    const visibleIds = new Set(
      (view.viewFields ?? []).filter((vf) => vf.isVisible).map((vf) => vf.fieldMetadataId),
    );
    return object.fields
      .filter(
        (f) =>
          visibleIds.has(f.id) &&
          f.id !== groupField?.id &&
          f.id !== titleField?.id &&
          f.type !== 'RICH_TEXT',
      )
      .slice(0, 3);
  }, [object.fields, view.viewFields, groupField, titleField]);

  const [recordsByCol, setRecordsByCol] = useState({});
  const [cursors, setCursors] = useState({});
  const [aggregates, setAggregates] = useState([]);

  async function loadColumn(col, cursor) {
    const r = await listBoardColumnAction({
      objectSlug,
      groupFieldName: groupField.name,
      value: col.value,
      cursor,
    });
    if (!r.ok) return;
    setRecordsByCol((prev) => ({
      ...prev,
      [col.key]: cursor ? [...(prev[col.key] ?? []), ...r.data.records] : r.data.records,
    }));
    setCursors((prev) => ({ ...prev, [col.key]: r.data.nextCursor }));
  }

  async function loadAggregates() {
    const r = await columnAggregatesAction({
      objectSlug,
      groupFieldName: groupField.name,
      sumFieldName: sumField?.name,
    });
    if (r.ok) setAggregates(r.data);
  }

  function reloadAll() {
    cols.forEach((col) => loadColumn(col));
    loadAggregates();
  }

  useEffect(() => {
    if (!groupField) return;
    // Carga inicial (fetch en mount); los setState ocurren tras await.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    reloadAll();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [groupField?.id, view.id]);

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );

  const aggFor = (col) => aggregates.find((a) => (a.value ?? null) === (col.value ?? null));
  const sumText = (sum) => {
    if (!sumField || !sum) return null;
    return sumField.type === 'CURRENCY' ? formatCurrency(sum, currency) : formatNumber(sum);
  };
  const colValue = (key) => cols.find((c) => c.key === key)?.value ?? null;
  const colOf = (recordId) =>
    Object.keys(recordsByCol).find((k) => recordsByCol[k]?.some((r) => r.id === recordId));

  async function onDragEnd(event) {
    const { active, over } = event;
    if (!over || active.id === over.id) return;

    const activeId = active.id;
    const sourceKey = active.data.current?.colKey ?? colOf(activeId);
    const targetKey = String(over.id).startsWith('col:')
      ? String(over.id).slice(4)
      : (over.data.current?.colKey ?? colOf(over.id));
    if (!sourceKey || !targetKey) return;

    const source = [...(recordsByCol[sourceKey] ?? [])];
    const activeIdx = source.findIndex((r) => r.id === activeId);
    if (activeIdx < 0) return;
    const [moved] = source.splice(activeIdx, 1);

    const target = sourceKey === targetKey ? source : [...(recordsByCol[targetKey] ?? [])];
    let overIdx = String(over.id).startsWith('col:')
      ? target.length
      : target.findIndex((r) => r.id === over.id);
    if (overIdx < 0) overIdx = target.length;
    target.splice(overIdx, 0, moved);

    const prev = target[overIdx - 1]?.position ?? null;
    const next = target[overIdx + 1]?.position ?? null;
    let newPos;
    try {
      newPos = generateKeyBetween(prev, next);
    } catch {
      newPos = generateKeyBetween(null, null);
    }
    moved.position = newPos;
    const changedGroup = targetKey !== sourceKey;
    if (changedGroup) moved.data = { ...moved.data, [groupField.name]: colValue(targetKey) };

    setRecordsByCol((prevState) => ({
      ...prevState,
      [sourceKey]: sourceKey === targetKey ? target : source,
      [targetKey]: target,
    }));

    const patch = changedGroup ? { [groupField.name]: colValue(targetKey) } : {};
    const r = await moveRecordAction({ objectSlug, recordId: activeId, position: newPos, patch });
    if (!r.ok) {
      toast.error(r.message || 'No se pudo mover');
      cols.forEach((col) => loadColumn(col));
    }
    loadAggregates();
  }

  const total = cols.reduce((sum, col) => sum + (aggFor(col)?.count ?? 0), 0);

  const bar = (
    <RecordViewBar
      objectSlug={objectSlug}
      views={views}
      activeViewId={activeViewId}
      count={total || undefined}
    />
  );

  if (!groupField) {
    return (
      <div className="flex h-full flex-col">
        {bar}
        <p className="text-tertiary p-6 text-sm">Este objeto no tiene un campo para agrupar.</p>
      </div>
    );
  }

  return (
    <div className="flex h-full flex-col">
      {bar}
      <DndContext
        id="record-board-dnd"
        sensors={sensors}
        collisionDetection={closestCorners}
        onDragEnd={onDragEnd}
      >
        <div className="flex min-h-0 flex-1 gap-5 overflow-x-auto p-5">
          {cols.map((col) => (
            <BoardColumn
              key={col.key}
              col={col}
              records={recordsByCol[col.key] ?? []}
              aggregate={aggFor(col)}
              sumText={sumText(aggFor(col)?.sum)}
              objectSlug={objectSlug}
              titleField={titleField}
              bodyFields={bodyFields}
              hasMore={Boolean(cursors[col.key])}
              loading={recordsByCol[col.key] === undefined}
              onLoadMore={() => loadColumn(col, cursors[col.key])}
            />
          ))}
        </div>
      </DndContext>
    </div>
  );
}

export default RecordBoard;
