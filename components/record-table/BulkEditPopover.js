'use client';

import { useState } from 'react';
import { getFieldComponents } from '@/components/fields/registry';

/**
 * Popover de edición masiva: elige un campo y su valor; al confirmar, aplica el
 * valor a todos los registros seleccionados. Reusa el componente Edit del tipo
 * (así el valor sale con la forma correcta: opción de SELECT, {amount} de
 * CURRENCY, etc.). Se excluyen los campos de sistema y los que no tienen Edit
 * (calculados, líneas): no son editables en masa.
 * @param {{ fields: object[], onApply: (fieldName:string, value:any)=>void }} props
 */
export function BulkEditPopover({ fields, onApply }) {
  const editable = fields.filter((f) => !f.isSystem && getFieldComponents(f.type).Edit);
  const [name, setName] = useState('');
  const field = editable.find((f) => f.name === name);
  const Edit = field ? getFieldComponents(field.type).Edit : null;

  return (
    <div className="border-border bg-elevated absolute top-full right-0 z-30 mt-1 w-64 rounded-lg border p-3 shadow-lg">
      <p className="text-secondary mb-2 text-xs font-medium">Editar campo en la selección</p>
      <select
        value={name}
        onChange={(e) => setName(e.target.value)}
        className="border-border bg-surface text-primary mb-2 h-8 w-full rounded-md border px-2 text-sm"
      >
        <option value="">Elige un campo…</option>
        {editable.map((f) => (
          <option key={f.id} value={f.name}>
            {f.label}
          </option>
        ))}
      </select>

      {field && Edit && (
        <div className="relative h-8">
          <Edit
            value={undefined}
            field={field}
            onCommit={(v) => onApply(field.name, v)}
            onCancel={() => {}}
          />
        </div>
      )}
      {field && Edit && (
        <p className="text-tertiary mt-2 text-[11px]">Enter para aplicar a los seleccionados.</p>
      )}
    </div>
  );
}

export default BulkEditPopover;
