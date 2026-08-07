'use client';

import { useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { CommandMenu } from './CommandMenu';
import { ShortcutsSheet } from './ShortcutsSheet';
import { listObjectsAction } from '@/app/(workspace)/objects/actions';

/** ¿El foco está en un campo de texto? (no interceptar atajos ahí). */
function inEditable(el) {
  if (!el) return false;
  const tag = el.tagName;
  return tag === 'INPUT' || tag === 'TEXTAREA' || el.isContentEditable;
}

/**
 * Atajos globales: ⌘K (menú), / y C (menú), ⌘/ (hoja), G+letra (navegar).
 * Monta el command menu y la hoja de atajos.
 */
export function AppShortcuts() {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [help, setHelp] = useState(false);
  const [objects, setObjects] = useState([]);
  const gPending = useRef(0);

  useEffect(() => {
    listObjectsAction().then((r) => {
      if (r?.ok) setObjects(r.data);
    });
  }, []);

  useEffect(() => {
    function onKey(e) {
      const mod = e.metaKey || e.ctrlKey;
      if (mod && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        setOpen((o) => !o);
        return;
      }
      if (mod && e.key === '/') {
        e.preventDefault();
        setHelp((h) => !h);
        return;
      }
      // Cualquier otra combinación con ⌘/Ctrl (⌘C, ⌘V, ⌘A…) no es un atajo
      // nuestro: no interceptar (si no, se rompe copiar/pegar).
      if (mod) return;
      if (inEditable(e.target)) return;

      // Secuencia G + letra.
      if (Date.now() - gPending.current < 800) {
        gPending.current = 0;
        const map = { h: '/', t: '/tasks', s: '/settings/profile' };
        const href = map[e.key.toLowerCase()];
        if (href) {
          e.preventDefault();
          router.push(href);
          return;
        }
      }
      if (e.key.toLowerCase() === 'g') {
        gPending.current = Date.now();
        return;
      }
      if (e.key === '/' || e.key.toLowerCase() === 'c') {
        e.preventDefault();
        setOpen(true);
      }
    }
    const openMenu = () => setOpen(true);
    window.addEventListener('keydown', onKey);
    window.addEventListener('command-menu:open', openMenu);
    return () => {
      window.removeEventListener('keydown', onKey);
      window.removeEventListener('command-menu:open', openMenu);
    };
  }, [router]);

  return (
    <>
      <CommandMenu open={open} onOpenChange={setOpen} objects={objects} />
      <ShortcutsSheet open={help} onOpenChange={setHelp} />
    </>
  );
}

export default AppShortcuts;
