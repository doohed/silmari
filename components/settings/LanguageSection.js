'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';

const LOCALES = [
  { value: 'es', label: 'Español' },
  { value: 'en', label: 'English' },
];

/**
 * Selector de idioma de la interfaz (es/en). Persiste en cookie y refresca los
 * server components para reflejar el cambio.
 */
export function LanguageSection() {
  const router = useRouter();
  const [locale, setLocale] = useState('es');

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setLocale(document.cookie.includes('locale=en') ? 'en' : 'es');
  }, []);

  function pick(next) {
    if (next === locale) return;
    setLocale(next);
    // eslint-disable-next-line react-hooks/immutability
    document.cookie = `locale=${next}; path=/; max-age=31536000; samesite=lax`;
    router.refresh();
  }

  return (
    <div className="mac-segment">
      {LOCALES.map((l) => (
        <button
          key={l.value}
          type="button"
          onClick={() => pick(l.value)}
          aria-pressed={locale === l.value}
          className="px-3 py-1 text-[13px]"
        >
          {l.label}
        </button>
      ))}
    </div>
  );
}

export default LanguageSection;
