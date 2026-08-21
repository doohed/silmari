'use client';

import { useSortable } from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { X } from 'lucide-react';
import { widgetDef } from '@/lib/dashboards/catalog';
import { Widget } from './Widget';

/* Los botones de la banda viven DENTRO del asa de arrastre, así que hay que
   cortarles el `pointerdown` antes de que llegue al sensor de dnd-kit: sin esto
   un clic en la «X» que se mueve tres píxeles se convierte en un arrastre y el
   widget no se llega a borrar. */
const stopDrag = (e) => e.stopPropagation();

const HEAD_BTN_BASE =
  'text-tertiary hover:bg-chip-gray hover:text-primary flex h-5 shrink-0 items-center justify-center rounded transition-colors';
const HEAD_BTN = `${HEAD_BTN_BASE} w-5`;

/**
 * Una tarjeta del lienzo: banda de título + gráfico. La tarjeta es una **lámina
 * pequeña** (`.mac-widget`) y su banda de título es la MISMA que la cabecera de
 * columnas de la tabla y que la fila de pestañas de la ficha (`.mac-list-head`,
 * altura `--list-head-h`): es el motivo que hace que el panel se lea como parte
 * de la app y no como un dashboard web pegado dentro.
 *
 * En modo edición el asa de arrastre es la **banda entera**, como la barra de
 * título de una ventana; no hay icono de agarre porque en una banda de 30 px un
 * grip suelto es un tercer control compitiendo con el título.
 *
 * @param {{
 *   widget: { id:string, type:string, w:number, h:number },
 *   metrics: object,
 *   editing: boolean,
 *   onRemove: () => void,
 *   onResize: () => void,
 * }} props
 */
export function WidgetCard({ widget, metrics, editing, onRemove, onResize }) {
  // Del asa se toman SOLO los `listeners` (los eventos de puntero). Los
  // `attributes` de dnd-kit le ponen `role="button"` y `tabIndex` al elemento, y
  // aquí el asa es la banda de título, que **contiene** los botones de tamaño y
  // de quitar: un botón dentro de otro es ARIA inválido y, en la práctica, hacía
  // que la banda entera se anunciara como «… 2×2 cambiar Quitar widget». No se
  // pierde nada: el arrastre por teclado necesitaría además un `KeyboardSensor`,
  // que este lienzo no monta.
  const { listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: widget.id,
    disabled: !editing,
  });
  const def = widgetDef(widget.type);

  const style = {
    transform: CSS.Translate.toString(transform),
    transition,
    gridColumn: `span ${widget.w}`,
    gridRow: `span ${widget.h}`,
    zIndex: isDragging ? 20 : undefined,
  };

  return (
    <div
      ref={setNodeRef}
      style={style}
      data-editing={editing || undefined}
      data-dragging={isDragging || undefined}
      className="mac-widget flex min-h-0 flex-col"
    >
      <div
        {...(editing ? listeners : null)}
        className={`mac-list-head flex shrink-0 items-center gap-1 px-2.5 ${
          editing ? 'cursor-grab active:cursor-grabbing' : ''
        }`}
      >
        <p className="text-secondary min-w-0 flex-1 truncate text-[11.5px] font-medium">
          {def?.title ?? widget.type}
        </p>
        {editing && (
          <div className="flex shrink-0 items-center gap-0.5">
            {/* El control de tamaño **dice el tamaño**: se probó con un icono
              (`Scaling`) y en 13 px se leía como «abrir en otra ventana». Un
              `2×2` es a la vez el estado actual y la invitación a cambiarlo, y
              es lo que hace un stepper del sistema. */}
            <button
              type="button"
              onPointerDown={stopDrag}
              onClick={onResize}
              className={`${HEAD_BTN_BASE} px-1 text-[10px] font-medium tabular-nums`}
              aria-label={`Tamaño ${widget.w}×${widget.h}, cambiar`}
              title="Clic para cambiar el tamaño"
            >
              {widget.w}×{widget.h}
            </button>
            <button
              type="button"
              onPointerDown={stopDrag}
              onClick={onRemove}
              className={`${HEAD_BTN} hover:text-danger`}
              aria-label="Quitar widget"
              title="Quitar del panel"
            >
              <X size={13} />
            </button>
          </div>
        )}
      </div>

      {/* Menos aire abajo que arriba: los gráficos ya traen su fila de etiquetas
        del eje, que hace de margen visual.
        `@container`: el widget mide entre 1/4 y 4/4 de la rejilla y, en móvil,
        media pantalla. Lo de dentro se ajusta al ANCHO DE LA TARJETA, no al de
        la ventana — un `md:` aquí no sabría distinguir una tarjeta de 1×1 de
        una de 4×2 en la misma pantalla. */}
      <div className="@container min-h-0 flex-1 px-3 pt-2.5 pb-3">
        <Widget type={widget.type} metrics={metrics} />
      </div>
    </div>
  );
}

export default WidgetCard;
