'use client';

import { getFieldComponents } from '@/components/fields/registry';
import { getFieldType } from '@/lib/field-types';
import { Avatar } from '@/components/ui/Avatar';

/**
 * Tipos que se alinean a la derecha, como la columna "Tamaño" del Finder o
 * cualquier columna numérica de Numbers: con `tabular-nums` las unidades quedan
 * en la misma vertical y la magnitud se compara de un vistazo. Solo números:
 * alinear texto a la derecha no ayuda a leer y sí deja un borde irregular.
 */
const RIGHT_ALIGNED = new Set(['NUMBER', 'CURRENCY', 'PERCENT', 'FORMULA', 'ROLLUP']);

/** ¿La columna de este campo se alinea a la derecha? */
export function fieldAlign(field) {
  return RIGHT_ALIGNED.has(field.type) ? 'right' : 'left';
}

/**
 * Contenido de una celda: muestra el Display del tipo o, si está en edición, su
 * Edit. Los campos sin componente Edit no son editables inline. La columna
 * primaria (identificador) muestra además un avatar.
 * @param {object} props
 * @param {object} props.field
 * @param {any} props.value
 * @param {object} [props.relation]  relación hidratada { id, label } (RELATION)
 * @param {boolean} props.editing
 * @param {boolean} [props.isPrimary]
 * @param {(v:any)=>void} props.onCommit
 * @param {()=>void} props.onCancel
 */
export function CellContent({ field, value, relation, editing, isPrimary, onCommit, onCancel }) {
  const { Display, Edit } = getFieldComponents(field.type);

  if (editing && Edit) {
    return <Edit value={value} field={field} onCommit={onCommit} onCancel={onCancel} />;
  }
  const label = getFieldType(field.type).toSearchText(value, field);
  return (
    <div
      className={`flex h-full w-full items-center gap-2 truncate px-3 ${
        fieldAlign(field) === 'right' ? 'justify-end' : ''
      }`}
    >
      {isPrimary && <Avatar name={label} size={19} />}
      <Display value={value} field={field} relation={relation} />
    </div>
  );
}

/** ¿El tipo del campo admite edición inline? */
export function isEditable(field) {
  return Boolean(getFieldComponents(field.type).Edit);
}

export default CellContent;
