'use client';

import { useEffect, useState } from 'react';

const THEMES = [
  { value: 'light', label: 'Claro' },
  { value: 'dark', label: 'Oscuro' },
];

/**
 * Selector de tema (claro/oscuro). Es el mismo interruptor que vive en el menú
 * de usuario; aquí se ofrece con etiqueta, junto al idioma, porque en Ajustes es
 * donde se busca.
 *
 * El estado se lee del DOM (la clase `.dark` que ya puso el layout desde la
 * cookie) y no de un estado de servidor: así no hay dos fuentes de verdad ni
 * parpadeo al montar.
 */
export function ThemeSection() {
  const [theme, setTheme] = useState('light');

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setTheme(document.documentElement.classList.contains('dark') ? 'dark' : 'light');
  }, []);

  function pick(next) {
    if (next === theme) return;
    setTheme(next);
    document.documentElement.classList.toggle('dark', next === 'dark');
    // eslint-disable-next-line react-hooks/immutability
    document.cookie = `theme=${next}; path=/; max-age=31536000; samesite=lax`;
  }

  return (
    <div className="mac-segment">
      {THEMES.map((t) => (
        <button
          key={t.value}
          type="button"
          onClick={() => pick(t.value)}
          aria-pressed={theme === t.value}
          className="px-3 py-1 text-[13px]"
        >
          {t.label}
        </button>
      ))}
    </div>
  );
}

export default ThemeSection;
