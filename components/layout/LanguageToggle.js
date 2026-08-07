'use client';

import { useRouter } from 'next/navigation';

/** Selector de idioma (es/en). Persiste en cookie y refresca. */
export function LanguageToggle() {
  const router = useRouter();

  function current() {
    if (typeof document === 'undefined') return 'es';
    return document.cookie.includes('locale=en') ? 'en' : 'es';
  }

  function setLocale(locale) {
    document.cookie = `locale=${locale}; path=/; max-age=31536000; samesite=lax`;
    router.refresh();
  }

  const c = current();
  return (
    <button
      type="button"
      onClick={() => setLocale(c === 'es' ? 'en' : 'es')}
      aria-label="Cambiar idioma"
      className="text-secondary hover:text-primary text-xs font-medium uppercase transition-colors"
    >
      {c}
    </button>
  );
}

export default LanguageToggle;
