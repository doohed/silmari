import { requireContext } from '@/lib/auth/dal';
import { getCurrentWorkspace } from '@/lib/workspaces/service';
import { WorkspaceForm } from '@/components/settings/WorkspaceForm';

export default async function WorkspaceSettingsPage() {
  const ctx = await requireContext();
  const workspace = await getCurrentWorkspace(ctx);
  return (
    <div className="mx-auto max-w-2xl px-8 py-8">
      <h1 className="text-primary mb-6 text-xl font-semibold tracking-tight">Espacio de trabajo</h1>
      <WorkspaceForm workspace={workspace} />
    </div>
  );
}
