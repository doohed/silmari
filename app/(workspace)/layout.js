import { requireOnboarded, getCurrentUser } from '@/lib/auth/dal';
import { listUserWorkspaces, getCurrentWorkspace } from '@/lib/workspaces/service';
import { listObjects } from '@/lib/metadata/object-service';
import { WorkspaceSwitcher } from '@/components/layout/WorkspaceSwitcher';
import { Sidebar } from '@/components/layout/Sidebar';
import { QueryProvider } from '@/components/providers/QueryProvider';
import { WorkspaceProvider } from '@/components/providers/WorkspaceProvider';
import { AppShortcuts } from '@/components/command-menu/AppShortcuts';
import { SearchButton } from '@/components/command-menu/SearchButton';
import { ThemeToggle } from '@/components/layout/ThemeToggle';
import { LanguageToggle } from '@/components/layout/LanguageToggle';
import { Avatar } from '@/components/ui/Avatar';
import { logoutAction } from './actions';

export default async function WorkspaceLayout({ children }) {
  const ctx = await requireOnboarded();
  const [user, workspaces, objects, workspace] = await Promise.all([
    getCurrentUser(),
    listUserWorkspaces(ctx.userId),
    listObjects(ctx),
    getCurrentWorkspace(ctx),
  ]);
  const settings = {
    currency: workspace.settings?.currency ?? 'EUR',
    timezone: workspace.settings?.timezone ?? 'Europe/Madrid',
  };

  return (
    <QueryProvider>
      <WorkspaceProvider value={settings}>
        <AppShortcuts />
        <div className="flex h-screen">
          <Sidebar objects={objects} />
          <div className="flex min-w-0 flex-1 flex-col">
            <header className="border-border bg-surface flex h-14 shrink-0 items-center justify-between gap-4 border-b px-5">
              <WorkspaceSwitcher workspaces={workspaces} activeId={ctx.workspaceId} />
              <SearchButton />
              <div className="flex items-center gap-3">
                <LanguageToggle />
                <ThemeToggle />
                {user && (
                  <div className="flex items-center gap-2">
                    <Avatar
                      name={`${user.firstName} ${user.lastName}`}
                      src={user.avatarUrl}
                      size={22}
                    />
                    <span className="text-secondary hidden text-xs sm:inline">
                      {`${user.firstName} ${user.lastName}`.trim()}
                    </span>
                  </div>
                )}
                <form action={logoutAction}>
                  <button
                    type="submit"
                    className="text-tertiary hover:text-primary text-xs transition-colors"
                  >
                    Cerrar sesión
                  </button>
                </form>
              </div>
            </header>
            <main className="min-w-0 flex-1 overflow-hidden">{children}</main>
          </div>
        </div>
      </WorkspaceProvider>
    </QueryProvider>
  );
}
