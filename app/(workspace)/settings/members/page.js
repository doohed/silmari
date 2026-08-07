import { requireContext } from '@/lib/auth/dal';
import { can } from '@/lib/auth/permissions';
import { listMembers } from '@/lib/members/service';
import { InviteForm } from '@/app/(workspace)/InviteForm';
import { RemoveMemberButton } from '@/app/(workspace)/RemoveMemberButton';

const ROLE_CHIP = {
  OWNER: 'bg-chip-purple text-chip-purple-fg',
  ADMIN: 'bg-chip-blue text-chip-blue-fg',
  MEMBER: 'bg-chip-gray text-chip-gray-fg',
};
const ROLE_LABEL = { OWNER: 'Propietario', ADMIN: 'Admin', MEMBER: 'Miembro' };

export default async function MembersPage() {
  const ctx = await requireContext();
  const members = await listMembers(ctx);
  const canInvite = can(ctx, 'members:invite');
  const canRemove = can(ctx, 'members:remove');

  return (
    <div className="mx-auto max-w-2xl px-8 py-8">
      <h1 className="text-primary mb-6 text-xl font-semibold tracking-tight">Miembros</h1>

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
    </div>
  );
}
