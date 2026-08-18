import { requireOnboarded, getCurrentUser } from '@/lib/auth/dal';
import { listUserWorkspaces, getCurrentWorkspace } from '@/lib/workspaces/service';
import { listObjects } from '@/lib/metadata/object-service';
import { Sidebar } from '@/components/layout/Sidebar';
import { SidebarShell } from '@/components/layout/SidebarShell';
import { QueryProvider } from '@/components/providers/QueryProvider';
import { WorkspaceProvider } from '@/components/providers/WorkspaceProvider';
import { ConfirmProvider } from '@/components/ui/ConfirmDialog';
import { AppShortcuts } from '@/components/command-menu/AppShortcuts';
import { VerifyEmailBanner } from '@/components/auth/VerifyEmailBanner';

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
        <ConfirmProvider>
          <AppShortcuts />
          {/* En móvil la barra del menú va arriba y el contenido debajo; en
            escritorio, el rail a la izquierda. De ahí el cambio de dirección. */}
          <div className="flex h-screen flex-col md:flex-row">
            <SidebarShell workspaceName={workspace.name}>
              <Sidebar
                objects={objects}
                workspaces={workspaces}
                activeId={ctx.workspaceId}
                user={user}
              />
            </SidebarShell>
            <div className="flex min-w-0 flex-1 flex-col">
              {user && !user.emailVerified && <VerifyEmailBanner email={user.email} />}
              <main className="min-w-0 flex-1 overflow-hidden">{children}</main>
            </div>
          </div>
        </ConfirmProvider>
      </WorkspaceProvider>
    </QueryProvider>
  );
}
