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
      className={cn(
        'press flex items-center gap-2.5 rounded-lg px-2.5 py-2 text-sm',
        active
          ? 'bg-accent-subtle text-primary font-medium shadow-xs'
          : 'text-secondary hover:bg-chip-gray hover:text-primary',
      )}
    >
      <Icon name={icon} size={15} className="shrink-0" />
      <span className="truncate">{label}</span>
    </Link>
  );
}

export default NavItem;
