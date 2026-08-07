import { cookies } from 'next/headers';

/**
 * i18n mínima (andamiaje). Diccionario para el chrome compartido; `es` por
 * defecto. La extracción completa de la app es un trabajo progresivo.
 */
const DICT = {
  es: {
    'nav.objects': 'Objetos',
    'nav.favorites': 'Favoritos',
    'nav.dashboards': 'Paneles',
    'nav.notes': 'Apuntes',
    'nav.tasks': 'Tareas',
    'nav.trash': 'Papelera',
    'nav.settings': 'Ajustes',
  },
  en: {
    'nav.objects': 'Objects',
    'nav.favorites': 'Favorites',
    'nav.dashboards': 'Dashboards',
    'nav.notes': 'Notes',
    'nav.tasks': 'Tasks',
    'nav.trash': 'Trash',
    'nav.settings': 'Settings',
  },
};

/** Idioma activo desde la cookie `locale` (es por defecto). */
export async function getLocale() {
  const value = (await cookies()).get('locale')?.value;
  return value === 'en' ? 'en' : 'es';
}

/** Traduce una clave para un idioma (fallback a es, luego a la propia clave). */
export function t(locale, key) {
  return DICT[locale]?.[key] ?? DICT.es[key] ?? key;
}
