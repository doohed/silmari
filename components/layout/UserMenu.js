'use client';

import { useEffect, useRef, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Settings, Sun, Moon, Languages, LogOut, ChevronsUpDown } from 'lucide-react';
import { Avatar } from '@/components/ui/Avatar';
import { logoutAction } from '@/app/(workspace)/actions';

const ITEM =
  'flex w-full items-center gap-2.5 rounded-md px-2 py-1.5 text-left text-[13px] text-secondary hover:bg-chip-gray hover:text-primary';

/**
 * Menú de cuenta: el avatar del usuario abre un desplegable con configuraciones,
 * tema, idioma y cerrar sesión. (Tema e idioma se persisten en cookie.)
 * @param {{ user: { firstName:string, lastName:string, email?:string, avatarUrl?:string|null } | null }} props
 */
export function UserMenu({ user }) {
  const router = useRouter();
  const ref = useRef(null);
  const [open, setOpen] = useState(false);
  const [dark, setDark] = useState(false);
  const [locale, setLocale] = useState('es');
  const name = user ? `${user.firstName} ${user.lastName}`.trim() : '';

  useEffect(() => {
    // Estado inicial desde el DOM/cookie (aplicados por el layout raíz).
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setDark(document.documentElement.classList.contains('dark'));
    setLocale(document.cookie.includes('locale=en') ? 'en' : 'es');
  }, []);

  useEffect(() => {
    if (!open) return undefined;
    const onDoc = (e) => {
      if (ref.current && !ref.current.contains(e.target)) setOpen(false);
    };
    const onKey = (e) => e.key === 'Escape' && setOpen(false);
    document.addEventListener('mousedown', onDoc);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onDoc);
      document.removeEventListener('keydown', onKey);
    };
  }, [open]);

  function toggleTheme() {
    const next = !dark;
    setDark(next);
    document.documentElement.classList.toggle('dark', next);
    document.cookie = `theme=${next ? 'dark' : 'light'}; path=/; max-age=31536000; samesite=lax`;
  }

  function toggleLocale() {
    const next = locale === 'es' ? 'en' : 'es';
    setLocale(next);
    document.cookie = `locale=${next}; path=/; max-age=31536000; samesite=lax`;
    router.refresh();
  }

  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        aria-haspopup="menu"
        aria-expanded={open}
        className="hover:bg-chip-gray flex w-full items-center gap-2 rounded-md px-1.5 py-1"
      >
        <Avatar name={name} src={user?.avatarUrl} size={24} className="shrink-0" />
        <span className="text-primary min-w-0 flex-1 truncate text-left text-[13px] font-medium">
          {name}
        </span>
        <ChevronsUpDown size={14} className="text-tertiary shrink-0" />
      </button>

      {open && (
        <div
          role="menu"
          className="anim-pop border-border bg-elevated absolute top-full left-0 z-40 mt-1 w-56 rounded-lg border p-1 shadow-md"
        >
          <div className="px-2 py-1.5">
            <p className="text-primary truncate text-[13px] font-medium">{name}</p>
            {user?.email && <p className="text-tertiary truncate text-xs">{user.email}</p>}
          </div>
          <div className="border-border my-1 border-t" />

          <Link href="/settings/profile" role="menuitem" onClick={() => setOpen(false)} className={ITEM}>
            <Settings size={15} className="text-tertiary" /> Configuraciones
          </Link>
          <button type="button" role="menuitem" onClick={toggleTheme} className={ITEM}>
            {dark ? (
              <Sun size={15} className="text-tertiary" />
            ) : (
              <Moon size={15} className="text-tertiary" />
            )}
            {dark ? 'Tema claro' : 'Tema oscuro'}
          </button>
          <button type="button" role="menuitem" onClick={toggleLocale} className={ITEM}>
            <Languages size={15} className="text-tertiary" />
            <span>
              Idioma: <span className="uppercase">{locale}</span>
            </span>
          </button>

          <div className="border-border my-1 border-t" />
          <form action={logoutAction}>
            <button type="submit" role="menuitem" className={`${ITEM} hover:text-danger`}>
              <LogOut size={15} className="text-tertiary" /> Cerrar sesión
            </button>
          </form>
        </div>
      )}
    </div>
  );
}

export default UserMenu;
