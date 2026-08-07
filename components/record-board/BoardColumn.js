'use client';

import { useDroppable } from '@dnd-kit/core';
import { SortableContext, verticalListSortingStrategy } from '@dnd-kit/sortable';
import { Chip } from '@/components/fields/Chip';
import { BoardCard } from './BoardCard';

/**
 * Columna del kanban: cabecera con agregados y lista sortable de tarjetas.
 */
export function BoardColumn({
  col,
  records,
  aggregate,
  sumText,
  objectSlug,
  titleField,
  bodyFields,
  hasMore,
  loading,
  onLoadMore,
}) {
  const { setNodeRef, isOver } = useDroppable({ id: `col:${col.key}` });

  return (
    <div className="flex w-80 shrink-0 flex-col">
      <div className="mb-3 flex items-center gap-2 px-1">
        <Chip label={col.label} color={col.color} />
        <span className="text-tertiary text-xs">{aggregate?.count ?? 0}</span>
        {sumText ? (
          <span className="text-secondary ml-auto text-xs font-medium tabular-nums">{sumText}</span>
        ) : null}
      </div>

      <div
        ref={setNodeRef}
        data-testid={`board-col-${col.key}`}
        className={`flex-1 space-y-2.5 rounded-xl p-1.5 transition-colors ${isOver ? 'bg-accent-subtle' : ''}`}
      >
        <SortableContext items={records.map((r) => r.id)} strategy={verticalListSortingStrategy}>
          {records.map((record) => (
            <BoardCard
              key={record.id}
              record={record}
              objectSlug={objectSlug}
              colKey={col.key}
              titleField={titleField}
              bodyFields={bodyFields}
            />
          ))}
        </SortableContext>

        {loading &&
          records.length === 0 &&
          [0, 1, 2].map((i) => (
            <div key={i} className="border-border bg-surface animate-pulse rounded-xl border p-3.5">
              <div className="bg-chip-gray mb-2 h-3 w-2/3 rounded" />
              <div className="bg-chip-gray h-2.5 w-1/2 rounded" />
            </div>
          ))}

        {!loading && records.length === 0 && (
          <p className="text-tertiary px-2 py-4 text-center text-xs">Vacío</p>
        )}

        {hasMore && (
          <button
            type="button"
            onClick={onLoadMore}
            className="text-accent w-full rounded-md px-2 py-1.5 text-center text-xs font-medium"
          >
            Cargar más
          </button>
        )}
      </div>
    </div>
  );
}

export default BoardColumn;
