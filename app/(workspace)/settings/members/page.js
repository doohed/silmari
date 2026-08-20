import { requireContext } from '@/lib/auth/dal';
import { can } from '@/lib/auth/permissions';
import { listMembers } from '@/lib/members/service';
import { InviteForm } from '@/app/(workspace)/InviteForm';
import { RemoveMemberButton } from '@/app/(workspace)/RemoveMemberButton';
import { SettingsPage } from '@/components/settings/SettingsPage';
import { SettingsGroup, SettingsRow } from '@/components/ui/SettingsGroup';

export const metadata = { title: 'Miembros · Silmari' };

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
    <SettingsPage title="Miembros">
      {canInvite && <InviteForm />}

      <SettingsGroup title={`En este espacio (${members.length})`}>
        {members.map((m) => {
          const removable = canRemove && m.role !== 'OWNER' && m.userId !== ctx.userId;
          return (
            <SettingsRow key={m.userId} label={m.name || m.email} hint={m.email}>
              <div className="flex items-center gap-3">
                <span
                  className={`rounded-full px-2 py-0.5 text-xs font-medium ${ROLE_CHIP[m.role]}`}
                >
                  {ROLE_LABEL[m.role]}
                </span>
                {removable && <RemoveMemberButton userId={m.userId} name={m.name || m.email} />}
              </div>
            </SettingsRow>
          );
        })}
      </SettingsGroup>
    </SettingsPage>
  );
}
