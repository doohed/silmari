'use client';

import Link from 'next/link';
import { ArrowLeft, Trash2, X, Maximize2 } from 'lucide-react';
import { getFieldType } from '@/lib/field-types';
import { Avatar } from '@/components/ui/Avatar';
import { EditableValue } from './EditableValue';
import { FavoriteButton } from './FavoriteButton';

/**
 * Botón de icono de la barra: un solo sitio para que los cinco midan igual (la
 * papelera y el favorito iban sin caja de hover y se leían como de otra barra).
 * El color de hover lo pone cada botón: la papelera va en rojo.
 */
const HEADER_ICON_BTN =
  'text-tertiary hover:bg-chip-gray flex size-7 shrink-0 items-center justify-center rounded-md transition-colors';

/**
 * Cabecera de la ficha: volver, identificador editable y acciones.
 * En modo cajón (`onClose`), el botón izquierdo cierra el panel y se ofrece un
 * enlace para abrir la ficha a página completa.
 *
 * `h-12`, la misma que `RecordViewBar`: la ficha se abre **pegada** a la tabla y
 * las dos barras superiores tienen que cerrar en la misma línea, o el hairline
 * cruza la ventana con un escalón.
 */
export function RecordHeader({ objectSlug, object, record, idField, onCommit, onDelete, onClose }) {
  const name = idField
    ? getFieldType(idField.type).toSearchText(record.data?.[idField.name], idField)
    : '';
  return (
    <header className="border-border flex h-12 shrink-0 items-center gap-2 border-b px-3">
      {onClose ? (
        <button
          type="button"
          onClick={onClose}
          className={`${HEADER_ICON_BTN} hover:text-primary`}
          aria-label="Cerrar"
        >
          <X size={16} />
        </button>
      ) : (
        <Link
          href={`/objects/${objectSlug}`}
          className={`${HEADER_ICON_BTN} hover:text-primary`}
          aria-label="Volver"
        >
          <ArrowLeft size={16} />
        </Link>
      )}
      <Avatar name={name} size={20} className="ml-0.5 shrink-0" />

      <div className="min-w-0 flex-1">
        {idField ? (
          <EditableValue
            field={idField}
            value={record.data?.[idField.name]}
            relation={record.relations?.[idField.name]}
            onCommit={(v) => onCommit(idField.name, v)}
            fit
            className="text-[13px] font-semibold"
          />
        ) : (
          <span className="text-primary text-[13px] font-semibold">Registro</span>
        )}
      </div>

      {onClose && (
        <Link
          href={`/objects/${objectSlug}/${record.id}`}
          className={`${HEADER_ICON_BTN} hover:text-primary`}
          aria-label="Abrir a página completa"
        >
          <Maximize2 size={15} />
        </Link>
      )}
      <FavoriteButton recordId={record.id} className={HEADER_ICON_BTN} />
      <button
        type="button"
        onClick={onDelete}
        className={`${HEADER_ICON_BTN} hover:text-danger`}
        aria-label="Eliminar registro"
      >
        <Trash2 size={15} />
      </button>
    </header>
  );
}

export default RecordHeader;
