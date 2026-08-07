'use client';

import { useCallback, useEffect, useRef, useState } from 'react';

const clamp = (v, min, max) => Math.max(min, Math.min(max, v));

/**
 * Ancho redimensionable por arrastre, persistido en localStorage. Devuelve el
 * ancho actual, si se está arrastrando, y el manejador para el asa.
 *
 * @param {{
 *   storageKey: string,
 *   defaultWidth: number,
 *   min: number,
 *   max: number,
 *   side?: 'left' | 'right',  // borde donde vive el asa
 * }} opts
 */
export function useResizableWidth({ storageKey, defaultWidth, min, max, side = 'right' }) {
  const [width, setWidth] = useState(defaultWidth);
  const [dragging, setDragging] = useState(false);
  const latest = useRef(width);
  useEffect(() => {
    latest.current = width;
  }, [width]);

  // Se lee tras montar (no en el initializer) para no romper la hidratación.
  useEffect(() => {
    const stored = Number(localStorage.getItem(storageKey));
    // eslint-disable-next-line react-hooks/set-state-in-effect
    if (stored) setWidth(clamp(stored, min, max));
  }, [storageKey, min, max]);

  const onResizeStart = useCallback(
    (e) => {
      e.preventDefault();
      // Safari usa captura implícita del puntero y no reenvía pointermove/up a
      // `window` durante el arrastre. Se captura el puntero en el asa y se
      // escucha en ese elemento (patrón fiable en todos los navegadores).
      const el = e.currentTarget;
      const pointerId = e.pointerId;
      const startX = e.clientX;
      const startW = latest.current;
      setDragging(true);
      document.body.style.userSelect = 'none';
      document.body.style.cursor = 'col-resize';
      try {
        el.setPointerCapture(pointerId);
      } catch {
        // sin soporte de captura: los listeners en `el` siguen funcionando
      }

      const onMove = (ev) => {
        const dx = ev.clientX - startX;
        const delta = side === 'left' ? -dx : dx;
        const maxW = Math.min(max, window.innerWidth * 0.86);
        setWidth(clamp(startW + delta, min, maxW));
      };
      const onUp = () => {
        setDragging(false);
        document.body.style.userSelect = '';
        document.body.style.cursor = '';
        el.removeEventListener('pointermove', onMove);
        el.removeEventListener('pointerup', onUp);
        el.removeEventListener('pointercancel', onUp);
        try {
          el.releasePointerCapture(pointerId);
        } catch {
          // ya liberado
        }
        localStorage.setItem(storageKey, String(latest.current));
      };

      el.addEventListener('pointermove', onMove);
      el.addEventListener('pointerup', onUp);
      el.addEventListener('pointercancel', onUp);
    },
    [min, max, side, storageKey],
  );

  return { width, dragging, onResizeStart };
}

export default useResizableWidth;
