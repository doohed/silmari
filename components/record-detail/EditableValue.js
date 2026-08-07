'use client';

import { useState } from 'react';
import { getFieldComponents } from '@/components/fields/registry';

/**
 * Valor editable en sitio: muestra el Display y cambia al Edit al hacer click.
 * @param {{ field: object, value: any, relation?: object, onCommit: (v:any)=>void, className?: string }} props
 */
export function EditableValue({ field, value, relation, onCommit, className }) {
  const [editing, setEditing] = useState(false);
  const { Display, Edit } = getFieldComponents(field.type);

  if (editing && Edit) {
    return (
      <div className={`relative h-8 ${className ?? ''}`}>
        <Edit
          value={value}
          field={field}
          onCommit={(v) => {
            setEditing(false);
            onCommit(v);
          }}
          onCancel={() => setEditing(false)}
        />
      </div>
    );
  }

  return (
    <button
      type="button"
      onClick={() => Edit && setEditing(true)}
      className={`hover:bg-chip-gray/50 flex h-8 w-full items-center rounded px-2 text-left text-sm ${Edit ? 'cursor-text' : 'cursor-default'} ${className ?? ''}`}
    >
      <Display value={value} field={field} relation={relation} />
    </button>
  );
}

export default EditableValue;
