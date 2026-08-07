'use client';

import { useEffect } from 'react';

/**
 * Cierra un popover/dropdown al hacer clic fuera del elemento referenciado o al
 * pulsar Escape. Desactívalo con `enabled=false` cuando el popover está cerrado
 * (evita listeners inútiles).
 * @param {import('react').RefObject<HTMLElement>} ref  contenedor (trigger + panel)
 * @param {() => void} onClose
 * @param {boolean} [enabled=true]
 */
export function useClickOutside(ref, onClose, enabled = true) {
  useEffect(() => {
    if (!enabled) return undefined;
    const onPointer = (e) => {
      if (ref.current && !ref.current.contains(e.target)) onClose();
    };
    const onKey = (e) => {
      if (e.key === 'Escape') onClose();
    };
    document.addEventListener('mousedown', onPointer);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onPointer);
      document.removeEventListener('keydown', onKey);
    };
  }, [ref, onClose, enabled]);
}

export default useClickOutside;
