'use client';

import { useEffect, useState } from 'react';
import {
  getRecordAction,
  getTimelineAction,
  getRelatedAction,
} from '@/app/(workspace)/objects/actions';
import { useResizableWidth } from '@/hooks/useResizableWidth';
import { ResizeHandle } from '@/components/ui/ResizeHandle';
import { RecordDetail } from './RecordDetail';

/**
 * Panel lateral (cajón) que muestra la ficha de un registro a la derecha, sin
 * salir de la tabla. Al abrirse crece su ancho y empuja la tabla; al cerrarse lo
 * encoge de vuelta. El ancho es redimensionable por arrastre (asa izquierda) y
 * se persiste. Carga la ficha con server actions al abrirse.
 *
 * @param {{
 *   open: boolean,
 *   objectSlug: string,
 *   object: object,
 *   recordId: string | null,
 *   onClose: () => void,
 *   onChanged?: () => void,
 * }} props
 */
export function RecordDrawer({ open, objectSlug, object, recordId, onClose, onChanged }) {
  const [data, setData] = useState(null);
  // Se mantiene montado mientras dure la transición de cierre; `render` vuelve a
  // montar al reabrir (ajuste de estado en render, patrón de React).
  const [render, setRender] = useState(open);
  if (open && !render) setRender(true);

  // `show` dispara la transición de apertura: en el primer frame tras montar
  // pasa de 0 al ancho elegido. Al cerrar, el ancho aplicado vuelve a 0 (derivado
  // de `open`) y el panel se desmonta al terminar la transición.
  const [show, setShow] = useState(false);

  const { width, dragging, onResizeStart } = useResizableWidth({
    storageKey: 'silmari.drawerWidth',
    defaultWidth: 620,
    min: 420,
    max: 960,
    side: 'left',
  });

  useEffect(() => {
    if (!open) return;
    const id = requestAnimationFrame(() => setShow(true));
    return () => cancelAnimationFrame(id);
  }, [open]);

  useEffect(() => {
    if (!open || !recordId) return;
    let active = true;
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setData(null);
    Promise.all([
      getRecordAction({ objectSlug, recordId }),
      getTimelineAction({ objectSlug, recordId }),
      getRelatedAction({ objectMetadataId: object.id, recordId }),
    ]).then(([rec, tl, rel]) => {
      if (!active || !rec?.ok) return;
      setData({
        record: rec.data,
        timeline: tl?.ok ? tl.data : [],
        related: rel?.ok ? rel.data : [],
      });
    });
    return () => {
      active = false;
    };
  }, [open, recordId, objectSlug, object.id]);

  useEffect(() => {
    if (!open) return;
    const onKey = (e) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, onClose]);

  if (!render) return null;

  return (
    // Panel en el flujo. El contenedor exterior anima su ancho (empuja la tabla);
    // el interior va anclado a la derecha con el ancho fijo, para descubrirse
    // desde ese borde sin reflow durante apertura/cierre.
    <div
      className="relative h-full shrink-0 overflow-hidden"
      style={{
        width: open && show ? width : 0,
        transition: dragging ? 'none' : 'width 240ms var(--ease-soft)',
      }}
      onTransitionEnd={(e) => {
        if (!open && e.propertyName === 'width' && e.target === e.currentTarget) setRender(false);
      }}
    >
      <div
        role="dialog"
        aria-modal="false"
        className="border-border bg-surface absolute inset-y-0 right-0 flex flex-col border-l"
        style={{ width }}
      >
        <ResizeHandle side="left" onPointerDown={onResizeStart} active={dragging} />
        {data ? (
          <RecordDetail
            key={data.record.id}
            objectSlug={objectSlug}
            object={object}
            initialRecord={data.record}
            initialTimeline={data.timeline}
            initialRelated={data.related}
            onClose={onClose}
            onChanged={onChanged}
          />
        ) : (
          <div className="flex flex-1 flex-col gap-3 p-4">
            <div className="bg-chip-gray h-8 w-1/2 animate-pulse rounded-md" />
            <div className="bg-chip-gray h-24 w-full animate-pulse rounded-md" />
            <div className="bg-chip-gray h-40 w-full animate-pulse rounded-md" />
          </div>
        )}
      </div>
    </div>
  );
}

export default RecordDrawer;
