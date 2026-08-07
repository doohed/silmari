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
        'press relative flex items-center gap-2.5 rounded-md px-2.5 py-1.5 text-[13px]',
        active
          ? 'bg-chip-gray text-primary font-medium'
          : 'text-secondary hover:bg-chip-gray/60 hover:text-primary',
      )}
    >
      {active && (
        <span className="bg-accent absolute top-1/2 left-0 h-4 w-0.5 -translate-y-1/2 rounded-full" />
      )}
      <Icon
        name={icon}
        size={15}
        className={cn('shrink-0', active ? 'text-primary' : 'text-tertiary')}
      />
      <span className="truncate">{label}</span>
    </Link>
  );
}

export default NavItem;
