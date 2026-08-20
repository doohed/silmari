'use client';

import { useState } from 'react';
import { getFieldComponents } from '@/components/fields/registry';

/**
 * Valor editable en sitio: muestra el Display y cambia al Edit al hacer click.
 *
 * `fit` ciñe la caja al texto en vez de estirarla. Lo usa el título de la
 * cabecera: a página completa la barra es ancha y el rectángulo gris del hover
 * cruzaba media ventana, como si el nombre fuera un campo de formulario.
 *
 * @param {{ field: object, value: any, relation?: object, onCommit: (v:any)=>void, className?: string, fit?: boolean }} props
 */
export function EditableValue({ field, value, relation, onCommit, className, fit = false }) {
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
      className={`hover:bg-chip-gray/50 flex h-8 items-center rounded-md px-2 text-left text-[13px] ${
        fit ? 'max-w-full' : 'w-full'
      } ${Edit ? 'cursor-text' : 'cursor-default'} ${className ?? ''}`}
    >
      <Display value={value} field={field} relation={relation} />
    </button>
  );
}

export default EditableValue;
