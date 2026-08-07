import { requireOnboarded, getCurrentUser } from '@/lib/auth/dal';
import { listUserWorkspaces, getCurrentWorkspace } from '@/lib/workspaces/service';
import { listObjects } from '@/lib/metadata/object-service';
import { Sidebar } from '@/components/layout/Sidebar';
import { QueryProvider } from '@/components/providers/QueryProvider';
import { WorkspaceProvider } from '@/components/providers/WorkspaceProvider';
import { ConfirmProvider } from '@/components/ui/ConfirmDialog';
import { AppShortcuts } from '@/components/command-menu/AppShortcuts';

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
          <div className="flex h-screen">
            <Sidebar
              objects={objects}
              workspaces={workspaces}
              activeId={ctx.workspaceId}
              user={user}
            />
            <main className="min-w-0 flex-1 overflow-hidden">{children}</main>
          </div>
        </ConfirmProvider>
      </WorkspaceProvider>
    </QueryProvider>
  );
}
