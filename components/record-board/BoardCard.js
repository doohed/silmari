'use client';

import { useRouter } from 'next/navigation';
import { useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { getFieldComponents } from '@/components/fields/registry';
import { getFieldType } from '@/lib/field-types';
import { readFieldValue } from '@/lib/records/field-path';
import { Avatar } from '@/components/ui/Avatar';

/**
 * Tarjeta de kanban (arrastrable). Muestra el identificador + campos de la vista.
 * @param {{ record: object, objectSlug: string, colKey: string, titleField: object, bodyFields: object[] }} props
 */
export function BoardCard({ record, objectSlug, colKey, titleField, bodyFields }) {
  const router = useRouter();
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: record.id,
    data: { colKey },
  });

  const style = {
    transform: CSS.Translate.toString(transform),
    transition,
    opacity: isDragging ? 0.5 : 1,
  };

  const TitleDisplay = titleField ? getFieldComponents(titleField.type).Display : null;
  const titleText = titleField
    ? getFieldType(titleField.type).toSearchText(record.data?.[titleField.name], titleField)
    : '';

  return (
    <div
      ref={setNodeRef}
      data-testid="board-card"
      style={style}
      {...attributes}
      {...listeners}
      onDoubleClick={() => router.push(`/objects/${objectSlug}/${record.id}`)}
      className="border-border bg-surface hover:border-border-strong cursor-grab rounded-xl border p-3.5 text-sm shadow-sm transition-shadow duration-200 hover:shadow-md active:cursor-grabbing"
    >
      <div className="text-primary mb-2 flex items-center gap-2.5 font-medium">
        <Avatar name={titleText} size={20} />
        <span className="min-w-0 truncate">
          {TitleDisplay ? (
            <TitleDisplay
              value={record.data?.[titleField.name]}
              field={titleField}
              relation={record.relations?.[titleField.name]}
            />
          ) : (
            '(sin nombre)'
          )}
        </span>
      </div>
      <div className="space-y-1.5">
        {bodyFields.map((f) => {
          const { Display } = getFieldComponents(f.type);
          return (
            <div key={f.id} className="text-secondary flex items-center gap-1.5 text-xs">
              <span className="text-tertiary shrink-0">{f.label}:</span>
              <span className="min-w-0 truncate">
                <Display
                  value={readFieldValue(record, f)}
                  field={f}
                  relation={record.relations?.[f.name]}
                />
              </span>
            </div>
          );
        })}
      </div>
    </div>
  );
}

export default BoardCard;
