import { NavItem } from '@/components/layout/NavItem';
import { FavoritesList } from '@/components/layout/FavoritesList';
import { WorkspaceSwitcher } from '@/components/layout/WorkspaceSwitcher';
import { UserMenu } from '@/components/layout/UserMenu';
import { NotificationsBell } from '@/components/notifications/NotificationsBell';
import { SearchButton } from '@/components/command-menu/SearchButton';
import { getLocale, t } from '@/lib/i18n';

/**
 * Navegación lateral (rail): menú de usuario (avatar → configuraciones, tema,
 * idioma, cerrar sesión), buscador, nombre del workspace y enlaces a los objetos
 * del workspace (generados desde la metadata).
 * @param {{
 *   objects: Array<{ id: string, slug: string, labelPlural: string, icon: string }>,
 *   workspaces: Array<{ id: string, name: string }>,
 *   activeId: string,
 *   user: { firstName: string, lastName: string, email?: string, avatarUrl?: string|null } | null,
 * }} props
 */
export async function Sidebar({ objects, workspaces, activeId, user }) {
  const locale = await getLocale();

  return (
    <aside className="border-border bg-surface flex h-full w-full flex-col border-r">
      <div className="flex items-center gap-1 p-2">
        <div className="min-w-0 flex-1">
          <UserMenu user={user} />
        </div>
        <NotificationsBell />
      </div>
      <div className="px-2">
        <SearchButton />
      </div>
      <div className="px-2 pt-2 pb-1">
        <WorkspaceSwitcher workspaces={workspaces} activeId={activeId} />
      </div>

      <nav className="flex-1 space-y-0.5 overflow-y-auto px-2.5 pb-3">
        <FavoritesList />

        <NavItem href="/dashboards" label={t(locale, 'nav.dashboards')} icon="LayoutDashboard" />
        {objects.map((o) => (
          <NavItem key={o.id} href={`/objects/${o.slug}`} label={o.labelPlural} icon={o.icon} />
        ))}

        <div className="border-border my-2 border-t" />

        <NavItem href="/notes" label={t(locale, 'nav.notes')} icon="StickyNote" />
        <NavItem href="/tasks" label={t(locale, 'nav.tasks')} icon="CheckSquare" />
        <NavItem href="/trash" label={t(locale, 'nav.trash')} icon="Trash2" />
      </nav>
    </aside>
  );
}

export default Sidebar;
