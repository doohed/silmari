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
      className="press border-border bg-bg text-tertiary hover:border-border-strong hover:text-secondary flex h-8 w-full items-center gap-2 rounded-md border px-2.5 text-xs"
    >
      <Search size={14} />
      <span className="flex-1 text-left">Buscar</span>
      <kbd className="border-border bg-surface rounded-md border px-1.5 py-0.5 font-mono text-[10px]">
        {mac ? '⌘' : 'Ctrl'} K
      </kbd>
    </button>
  );
}

export default SearchButton;
