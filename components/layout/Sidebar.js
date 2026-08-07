import Link from 'next/link';
import { NavItem } from '@/components/layout/NavItem';
import { FavoritesList } from '@/components/layout/FavoritesList';
import { getLocale, t } from '@/lib/i18n';

/**
 * Navegación lateral: enlaces a los objetos del workspace (generada desde la
 * metadata, sin código por objeto).
 * @param {{ objects: Array<{ id: string, slug: string, labelPlural: string, icon: string }> }} props
 */
export async function Sidebar({ objects }) {
  const locale = await getLocale();
  return (
    <aside className="border-border bg-surface flex w-60 shrink-0 flex-col border-r">
      <div className="border-border flex h-14 items-center border-b px-5">
        <Link href="/" className="text-primary text-base font-semibold tracking-tight">
          Silmari
        </Link>
      </div>
      <nav className="flex-1 space-y-1 overflow-y-auto p-3">
        <FavoritesList />

        {/* Lista plana: Paneles · objetos del workspace · Apuntes/Tareas/Papelera/Ajustes. */}
        <NavItem href="/dashboards" label={t(locale, 'nav.dashboards')} icon="LayoutDashboard" />
        {objects.map((o) => (
          <NavItem key={o.id} href={`/objects/${o.slug}`} label={o.labelPlural} icon={o.icon} />
        ))}
        <NavItem href="/notes" label={t(locale, 'nav.notes')} icon="StickyNote" />
        <NavItem href="/tasks" label={t(locale, 'nav.tasks')} icon="CheckSquare" />
        <NavItem href="/trash" label={t(locale, 'nav.trash')} icon="Trash2" />
        <NavItem href="/settings/profile" label={t(locale, 'nav.settings')} icon="Settings" />
      </nav>
    </aside>
  );
}

export default Sidebar;
