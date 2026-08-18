'use client';

import { ChevronRight } from 'lucide-react';
import { getFieldComponents } from '@/components/fields/registry';
import { getFieldType } from '@/lib/field-types';
import { readFieldValue } from '@/lib/records/field-path';
import { Avatar } from '@/components/ui/Avatar';

/**
 * Lista de registros en tarjetas, para pantallas estrechas.
 *
 * Una tabla con scroll horizontal en un móvil es inservible: no se ve el
 * identificador mientras se desplaza y las celdas quedan a un dedo de ancho.
 * Aquí cada registro es una tarjeta con su identificador arriba y unos pocos
 * campos debajo.
 *
 * **No es editable en sitio.** Tocar la tarjeta abre la ficha, que ya está
 * pensada para editar campo a campo y funciona bien en vertical. Duplicar la
 * edición inline en móvil sería mucha superficie para un gesto que ahí no es
 * cómodo.
 *
 * El scroll infinito lo comparte con la tabla: el contenedor es el mismo y
 * `onScroll` decide cuándo pedir la página siguiente.
 *
 * @param {{
 *   rows: Array<object>,
 *   fields: Array<object>,
 *   primaryFieldId: string | null,
 *   onOpen: (recordId: string) => void,
 * }} props
 */
export function RecordCards({ rows, fields, primaryFieldId, onOpen }) {
  const primary = fields.find((f) => f.id === primaryFieldId) ?? fields[0];
  // Tres campos además del identificador: suficiente para reconocer el registro
  // sin convertir la tarjeta en un muro de texto.
  const secondary = fields.filter((f) => f.id !== primary?.id).slice(0, 3);

  return (
    <ul className="divide-border divide-y">
      {rows.map((record) => {
        const primaryValue = primary ? readFieldValue(record, primary) : null;
        const label = primary
          ? getFieldType(primary.type).toSearchText(primaryValue, primary)
          : '(sin nombre)';

        return (
          <li key={record.id}>
            <button
              type="button"
              onClick={() => onOpen(record.id)}
              className="press hover:bg-chip-gray/50 flex w-full items-center gap-3 px-4 py-3 text-left"
            >
              <Avatar name={label} size={32} />

              <div className="min-w-0 flex-1">
                <p className="text-primary truncate text-sm font-medium">
                  {label || '(sin nombre)'}
                </p>

                <dl className="mt-1 space-y-0.5">
                  {secondary.map((field) => {
                    const value = readFieldValue(record, field);
                    const { Display } = getFieldComponents(field.type);
                    // Los campos vacíos no ocupan sitio en una pantalla pequeña.
                    if (value === null || value === undefined || value === '') return null;
                    if (Array.isArray(value) && value.length === 0) return null;

                    return (
                      <div key={field.id} className="flex items-baseline gap-2 text-xs">
                        <dt className="text-tertiary shrink-0">{field.label}</dt>
                        <dd className="text-secondary min-w-0 truncate">
                          <Display
                            value={value}
                            field={field}
                            relation={record.relations?.[field.name]}
                          />
                        </dd>
                      </div>
                    );
                  })}
                </dl>
              </div>

              <ChevronRight size={16} className="text-tertiary shrink-0" />
            </button>
          </li>
        );
      })}
    </ul>
  );
}

export default RecordCards;
