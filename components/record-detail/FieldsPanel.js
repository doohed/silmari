'use client';

import { useState } from 'react';
import { ChevronDown, ChevronRight } from 'lucide-react';
import { readFieldValue } from '@/lib/records/field-path';
import { EditableValue } from './EditableValue';

/**
 * Panel de campos, agrupados y colapsables. Todos editables en sitio. Con
 * `hideHeader` se oculta el título "Detalles" (cuando ya es el nombre de la
 * pestaña que lo contiene, en el panel lateral).
 * @param {{ fields: object[], record: object, onCommit: (name:string, value:any)=>void, hideHeader?: boolean }} props
 */
export function FieldsPanel({ fields, record, onCommit, hideHeader = false }) {
  const [open, setOpen] = useState(true);
  const collapsed = !hideHeader && !open;

  return (
    <div className="p-3">
      {!hideHeader && (
        <button
          type="button"
          onClick={() => setOpen((o) => !o)}
          className="text-tertiary mb-2 flex items-center gap-1 px-2 text-[11px] font-medium tracking-wide uppercase"
        >
          {open ? <ChevronDown size={13} /> : <ChevronRight size={13} />}
          Detalles
        </button>
      )}

      {!collapsed && (
        <dl className="space-y-1.5">
          {fields.map((field) => (
            <div key={field.id} className="grid grid-cols-[120px_1fr] items-center gap-2">
              <dt className="text-secondary truncate px-2 text-xs" title={field.label}>
                {field.label}
              </dt>
              <dd className="min-w-0">
                <EditableValue
                  field={field}
                  value={readFieldValue(record, field)}
                  relation={record.relations?.[field.name]}
                  onCommit={(v) => onCommit(field.name, v)}
                />
              </dd>
            </div>
          ))}
        </dl>
      )}
    </div>
  );
}

export default FieldsPanel;
