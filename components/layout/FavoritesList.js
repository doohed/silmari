'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import {
  DndContext,
  closestCenter,
  PointerSensor,
  KeyboardSensor,
  useSensor,
  useSensors,
} from '@dnd-kit/core';
import {
  SortableContext,
  verticalListSortingStrategy,
  useSortable,
  sortableKeyboardCoordinates,
  arrayMove,
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { Icon } from '@/components/ui/Icon';
import { listFavoritesAction, reorderFavoritesAction } from '@/app/(workspace)/objects/actions';

function FavItem({ fav }) {
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: fav.id,
  });
  const style = {
    transform: CSS.Translate.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
  };
  return (
    <div ref={setNodeRef} style={style} {...attributes} {...listeners}>
      <Link
        href={fav.href}
        className="text-secondary hover:bg-chip-gray hover:text-primary flex items-center gap-2 rounded-md px-2 py-1.5 text-sm"
      >
        <Icon name={fav.icon} size={15} className="shrink-0" />
        <span className="truncate">{fav.label}</span>
      </Link>
    </div>
  );
}

export function FavoritesList() {
  const [items, setItems] = useState([]);

  const refresh = useCallback(() => {
    listFavoritesAction().then((r) => {
      if (r?.ok) setItems(r.data);
    });
  }, []);

  useEffect(() => {
    refresh();
    const onChange = () => refresh();
    window.addEventListener('favorites:changed', onChange);
    return () => window.removeEventListener('favorites:changed', onChange);
  }, [refresh]);

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 5 } }),
    useSensor(KeyboardSensor, { coordinateGetter: sortableKeyboardCoordinates }),
  );

  function onDragEnd(e) {
    const { active, over } = e;
    if (!over || active.id === over.id) return;
    const oldI = items.findIndex((i) => i.id === active.id);
    const newI = items.findIndex((i) => i.id === over.id);
    const next = arrayMove(items, oldI, newI);
    setItems(next);
    reorderFavoritesAction({ orderedIds: next.map((i) => i.id) });
  }

  if (items.length === 0) return null;

  return (
    <div className="mb-1">
      <p className="text-tertiary px-2 py-1.5 text-[11px] font-medium tracking-wider uppercase">
        Favoritos
      </p>
      <DndContext
        id="favorites-dnd"
        sensors={sensors}
        collisionDetection={closestCenter}
        onDragEnd={onDragEnd}
      >
        <SortableContext items={items.map((i) => i.id)} strategy={verticalListSortingStrategy}>
          {items.map((fav) => (
            <FavItem key={fav.id} fav={fav} />
          ))}
        </SortableContext>
      </DndContext>
    </div>
  );
}

export default FavoritesList;
