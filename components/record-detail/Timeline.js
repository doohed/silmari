'use client';

import { formatDistanceToNow } from 'date-fns';
import { es } from 'date-fns/locale';
import { Avatar } from '@/components/ui/Avatar';

/**
 * Timeline en lenguaje humano.
 * @param {{ items: Array<{ id:string, actorName:string, text:string, createdAt:string }> }} props
 */
export function Timeline({ items }) {
  if (!items?.length) {
    return <p className="text-tertiary p-6 text-center text-sm">Sin actividad todavía</p>;
  }
  return (
    <ul className="stagger space-y-3.5 p-6">
      {items.map((it) => (
        <li key={it.id} className="flex gap-3 text-sm">
          <Avatar name={it.actorName} size={24} className="mt-0.5" />
          <div className="min-w-0">
            <p className="text-primary">
              <span className="font-medium">{it.actorName}</span> {it.text}
            </p>
            <p className="text-tertiary text-xs">
              {formatDistanceToNow(new Date(it.createdAt), { addSuffix: true, locale: es })}
            </p>
          </div>
        </li>
      ))}
    </ul>
  );
}

export default Timeline;
