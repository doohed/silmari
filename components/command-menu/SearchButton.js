'use client';

import { useEffect, useState } from 'react';
import { Search } from 'lucide-react';

/** Botón de búsqueda del topbar: abre el ⌘K. Muestra el atajo según plataforma. */
export function SearchButton() {
  const [mac, setMac] = useState(true);
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setMac(/Mac|iPhone|iPad/.test(navigator.platform || navigator.userAgent));
  }, []);

  return (
    <button
      type="button"
      onClick={() => window.dispatchEvent(new Event('command-menu:open'))}
      className="press mac-focus border-sidebar-border bg-surface/70 text-tertiary hover:bg-surface hover:text-secondary flex h-7 w-full items-center gap-2 rounded-lg border px-2 text-[13px] shadow-xs"
    >
      <Search size={14} />
      <span className="flex-1 text-left">Buscar</span>
      <kbd className="text-tertiary font-sans text-[11px]">{mac ? '⌘' : 'Ctrl'} K</kbd>
    </button>
  );
}

export default SearchButton;
