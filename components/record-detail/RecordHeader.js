'use client';

import Link from 'next/link';
import { ArrowLeft, Trash2 } from 'lucide-react';
import { getFieldType } from '@/lib/field-types';
import { Avatar } from '@/components/ui/Avatar';
import { EditableValue } from './EditableValue';
import { FavoriteButton } from './FavoriteButton';

/**
 * Cabecera de la ficha: volver, identificador editable y acciones.
 */
export function RecordHeader({ objectSlug, object, record, idField, onCommit, onDelete }) {
  const name = idField
    ? getFieldType(idField.type).toSearchText(record.data?.[idField.name], idField)
    : '';
  return (
    <header className="border-border flex h-12 shrink-0 items-center gap-2.5 border-b px-4">
      <Link
        href={`/objects/${objectSlug}`}
        className="text-tertiary hover:bg-chip-gray hover:text-primary flex h-7 w-7 shrink-0 items-center justify-center rounded-md"
        aria-label="Volver"
      >
        <ArrowLeft size={16} />
      </Link>
      <Avatar name={name} size={22} className="shrink-0" />

      <div className="min-w-0 flex-1">
        {idField ? (
          <EditableValue
            field={idField}
            value={record.data?.[idField.name]}
            relation={record.relations?.[idField.name]}
            onCommit={(v) => onCommit(idField.name, v)}
            className="text-sm font-semibold"
          />
        ) : (
          <span className="text-primary text-sm font-semibold">Registro</span>
        )}
      </div>

      <FavoriteButton recordId={record.id} />
      <button
        type="button"
        onClick={onDelete}
        className="text-tertiary hover:text-danger shrink-0 transition-colors"
        aria-label="Eliminar registro"
      >
        <Trash2 size={16} />
      </button>
    </header>
  );
}

export default RecordHeader;
