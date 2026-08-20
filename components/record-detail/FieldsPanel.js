'use client';

import { useState } from 'react';
import { ChevronDown, ChevronRight } from 'lucide-react';
import { readFieldValue } from '@/lib/records/field-path';
import { EditableValue } from './EditableValue';
import { LineItemsEditor } from '@/components/fields/LineItemsEditor';

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
    // `@container`: el mismo panel vive en el cajón (ancho) y en la columna
    // lateral de la ficha a página completa (288 px). Con dos columnas fijas ahí
    // el valor se quedaba en 112 px y los emails salían cortados, así que por
    // debajo de 24rem la etiqueta se pone encima. Consulta de CONTENEDOR y no de
    // viewport: lo que manda es el ancho del panel, no el de la ventana.
    <div className="@container">
      {/* A página completa esta cabecera es la banda de títulos de SU columna:
        misma clase y misma altura que la de la tabla y la de las pestañas, para
        que el hairline cruce la ventana de lado a lado sin escalones. */}
      {!hideHeader && (
        <button
          type="button"
          onClick={() => setOpen((o) => !o)}
          aria-expanded={open}
          className="mac-list-head text-secondary hover:text-primary sticky top-0 flex w-full items-center gap-1 px-3 text-[11.5px] font-medium"
        >
          {open ? <ChevronDown size={12} /> : <ChevronRight size={12} />}
          Detalles
        </button>
      )}

      {!collapsed && (
        // Lista de la ventana "Información" del Finder: etiqueta a la izquierda,
        // valor a la derecha y un hairline entre filas que **arranca sangrado**
        // (lo da el `px-4` del contenedor, no un borde a sangre). Antes era una
        // rejilla suelta sobre el blanco: sin separadores no había lista, solo
        // texto flotando, y con 6 campos el panel parecía a medio hacer.
        <dl className="px-4 py-2">
          {fields.map((field) =>
            field.type === 'LINE_ITEMS' ? (
              // Ancho completo: no cabe en las dos columnas de la lista.
              <div key={field.id} className="border-border py-2 [&:not(:first-child)]:border-t">
                <p className="text-secondary mb-1.5 text-[13px]">{field.label}</p>
                <LineItemsEditor
                  field={field}
                  value={readFieldValue(record, field) ?? []}
                  onCommit={(v) => onCommit(field.name, v)}
                />
              </div>
            ) : (
              <div
                key={field.id}
                className="border-border grid gap-x-3 py-1 @[24rem]:grid-cols-[132px_1fr] @[24rem]:items-center @[24rem]:py-0.5 [&:not(:first-child)]:border-t"
              >
                <dt
                  className="text-secondary truncate text-[13px] @max-[24rem]:pt-1"
                  title={field.label}
                >
                  {field.label}
                </dt>
                <dd className="-mx-2 min-w-0">
                  <EditableValue
                    field={field}
                    value={readFieldValue(record, field)}
                    relation={record.relations?.[field.name]}
                    onCommit={(v) => onCommit(field.name, v)}
                  />
                </dd>
              </div>
            ),
          )}
        </dl>
      )}
    </div>
  );
}

export default FieldsPanel;
