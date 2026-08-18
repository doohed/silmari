'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { Icon } from '@/components/ui/Icon';
import { cn } from '@/lib/utils/cn';

/**
 * Entrada de navegación con estado activo según la ruta.
 * @param {{ href: string, label: string, icon?: string }} props
 */
export function NavItem({ href, label, icon }) {
  const pathname = usePathname();
  const active = pathname === href || pathname.startsWith(`${href}/`);

  return (
    <Link
      href={href}
      aria-current={active ? 'page' : undefined}
      className={cn(
        'press relative flex h-7 items-center gap-2.5 rounded-lg px-2 text-[13px]',
        // Selección rellena de color, como la barra lateral de macOS: la fila
        // activa se ve de un vistazo sin tener que comparar grises. Sustituye a
        // la marca lateral fina, que ahí sobra.
        active
          ? 'bg-accent text-accent-fg font-medium shadow-xs'
          : 'text-secondary hover:bg-primary/[0.05] hover:text-primary',
      )}
    >
      <Icon
        name={icon}
        size={15}
        className={cn('shrink-0', active ? 'text-accent-fg' : 'text-tertiary')}
      />
      <span className="truncate">{label}</span>
    </Link>
  );
}

export default NavItem;
