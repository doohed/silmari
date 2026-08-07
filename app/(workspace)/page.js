import { requireContext } from '@/lib/auth/dal';
import { can } from '@/lib/auth/permissions';
import { getCurrentWorkspace } from '@/lib/workspaces/service';
import { listMembers } from '@/lib/members/service';
import { InviteForm } from './InviteForm';
import { RemoveMemberButton } from './RemoveMemberButton';

const ROLE_CHIP = {
  OWNER: 'bg-chip-purple text-chip-purple-fg',
  ADMIN: 'bg-chip-blue text-chip-blue-fg',
  MEMBER: 'bg-chip-gray text-chip-gray-fg',
};

const ROLE_LABEL = { OWNER: 'Propietario', ADMIN: 'Admin', MEMBER: 'Miembro' };

export default async function WorkspaceHomePage() {
  const ctx = await requireContext();
  const [workspace, members] = await Promise.all([getCurrentWorkspace(ctx), listMembers(ctx)]);

  const canInvite = can(ctx, 'members:invite');
  const canRemove = can(ctx, 'members:remove');

  return (
    <main className="mx-auto w-full max-w-3xl px-6 py-10">
      <h1 className="text-primary text-xl font-semibold tracking-tight">{workspace.name}</h1>
      <p className="text-secondary mt-1 text-sm">Espacio de trabajo · /{workspace.slug}</p>

      <section className="mt-8">
        <div className="mb-3 flex items-center justify-between">
          <h2 className="text-primary text-sm font-semibold">Miembros</h2>
          <span className="text-tertiary text-xs">{members.length}</span>
        </div>

        {canInvite && (
          <div className="mb-4">
            <InviteForm />
          </div>
        )}

        <ul className="border-border bg-surface divide-border divide-y rounded-lg border">
          {members.map((m) => {
            const removable = canRemove && m.role !== 'OWNER' && m.userId !== ctx.userId;
            return (
              <li key={m.userId} className="flex items-center justify-between px-4 py-2.5">
                <div className="min-w-0">
                  <p className="text-primary truncate text-sm font-medium">{m.name || m.email}</p>
                  <p className="text-tertiary truncate text-xs">{m.email}</p>
                </div>
                <div className="flex items-center gap-3">
                  <span className={`rounded px-2 py-0.5 text-xs font-medium ${ROLE_CHIP[m.role]}`}>
                    {ROLE_LABEL[m.role]}
                  </span>
                  {removable && <RemoveMemberButton userId={m.userId} name={m.name || m.email} />}
                </div>
              </li>
            );
          })}
        </ul>
      </section>
    </main>
  );
}
