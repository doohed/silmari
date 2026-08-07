import { describe, it, expect } from 'vitest';
import { createAccount } from '@/lib/accounts/signup';
import { inviteMember, listMembers } from '@/lib/members/service';
import { acceptInvitation, getInvitationByToken } from '@/lib/invitations/service';

async function ownerCtx() {
  const { userId, workspaceId } = await createAccount({
    firstName: 'Owner',
    lastName: 'Uno',
    email: 'owner@test.dev',
    password: 'secret123',
    workspaceName: 'Acme',
  });
  return { userId, workspaceId, role: 'OWNER' };
}

describe('invitaciones', () => {
  it('un OWNER invita y un usuario nuevo acepta y se une', async () => {
    const ctx = await ownerCtx();

    const { token } = await inviteMember(ctx, { email: 'nuevo@test.dev', role: 'MEMBER' });
    expect(token).toBeTruthy();

    const info = await getInvitationByToken(token);
    expect(info.email).toBe('nuevo@test.dev');
    expect(info.isExistingUser).toBe(false);
    expect(info.workspaceName).toBe('Acme');

    const session = await acceptInvitation({
      token,
      firstName: 'Nuevo',
      lastName: 'Miembro',
      password: 'secret123',
    });
    expect(session.workspaceId).toBe(ctx.workspaceId);

    const members = await listMembers(ctx);
    expect(members).toHaveLength(2);
    expect(members.map((m) => m.email)).toContain('nuevo@test.dev');
  });

  it('un MEMBER no puede invitar (permiso denegado)', async () => {
    const ctx = await ownerCtx();
    const memberCtx = { ...ctx, role: 'MEMBER' };
    await expect(inviteMember(memberCtx, { email: 'x@test.dev', role: 'MEMBER' })).rejects.toThrow(
      /permiso/i,
    );
  });

  it('un token ya usado no se puede volver a aceptar', async () => {
    const ctx = await ownerCtx();
    const { token } = await inviteMember(ctx, { email: 'once@test.dev', role: 'MEMBER' });
    await acceptInvitation({ token, firstName: 'Una', lastName: 'Vez', password: 'secret123' });
    await expect(
      acceptInvitation({ token, firstName: 'Otra', lastName: 'Vez', password: 'secret123' }),
    ).rejects.toThrow();
  });
});
