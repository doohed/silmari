'use client';

import { useEffect, useState } from 'react';
import { Sun, Moon } from 'lucide-react';

/** Alterna tema claro/oscuro; persiste en cookie y aplica la clase `.dark`. */
export function ThemeToggle() {
  const [dark, setDark] = useState(false);

  useEffect(() => {
    // Sincroniza el estado inicial desde el DOM (aplicado por el layout raíz).
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setDark(document.documentElement.classList.contains('dark'));
  }, []);

  function toggle() {
    const next = !dark;
    setDark(next);
    document.documentElement.classList.toggle('dark', next);
    document.cookie = `theme=${next ? 'dark' : 'light'}; path=/; max-age=31536000; samesite=lax`;
  }

  return (
    <button
      type="button"
      onClick={toggle}
      aria-label={dark ? 'Cambiar a tema claro' : 'Cambiar a tema oscuro'}
      className="text-secondary hover:text-primary transition-colors"
    >
      {dark ? <Sun size={15} /> : <Moon size={15} />}
    </button>
  );
}

export default ThemeToggle;
