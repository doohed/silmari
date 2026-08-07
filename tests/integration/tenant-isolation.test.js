import { describe, it, expect } from 'vitest';
import { createAccount } from '@/lib/accounts/signup';
import { authenticate } from '@/lib/accounts/authenticate';
import { listMembers, inviteMember } from '@/lib/members/service';
import { getCurrentWorkspace } from '@/lib/workspaces/service';
import { getMembershipRole } from '@/lib/workspaces/service';

/** Crea una cuenta y devuelve su ctx OWNER. */
async function makeAccount(suffix) {
  const { userId, workspaceId } = await createAccount({
    firstName: `User${suffix}`,
    lastName: 'Test',
    email: `user${suffix}@test.dev`,
    password: 'secret123',
    workspaceName: `Workspace ${suffix}`,
  });
  return { userId, workspaceId, role: 'OWNER' };
}

describe('multi-tenancy: aislamiento entre workspaces', () => {
  it('un usuario solo ve los miembros de SU workspace', async () => {
    const ctxA = await makeAccount('A');
    const ctxB = await makeAccount('B');

    const membersA = await listMembers(ctxA);
    const membersB = await listMembers(ctxB);

    expect(membersA).toHaveLength(1);
    expect(membersB).toHaveLength(1);
    expect(membersA[0].userId).toBe(ctxA.userId);
    expect(membersB[0].userId).toBe(ctxB.userId);

    // Ningún miembro de A aparece en B y viceversa.
    const idsA = membersA.map((m) => m.userId);
    const idsB = membersB.map((m) => m.userId);
    expect(idsA).not.toContain(ctxB.userId);
    expect(idsB).not.toContain(ctxA.userId);
  });

  it('el workspace devuelto es siempre el del ctx, nunca el de otro', async () => {
    const ctxA = await makeAccount('A');
    const ctxB = await makeAccount('B');

    const wsA = await getCurrentWorkspace(ctxA);
    expect(wsA.id).toBe(ctxA.workspaceId);
    expect(wsA.id).not.toBe(ctxB.workspaceId);
  });

  it('un usuario NO pertenece al workspace de otro', async () => {
    const ctxA = await makeAccount('A');
    const ctxB = await makeAccount('B');

    expect(await getMembershipRole(ctxA.userId, ctxA.workspaceId)).toBe('OWNER');
    expect(await getMembershipRole(ctxA.userId, ctxB.workspaceId)).toBeNull();
  });

  it('login resuelve solo el workspace propio del usuario', async () => {
    const ctxA = await makeAccount('A');
    await makeAccount('B');

    const session = await authenticate({ email: 'userA@test.dev', password: 'secret123' });
    expect(session.userId).toBe(ctxA.userId);
    expect(session.workspaceId).toBe(ctxA.workspaceId);
  });

  it('un servicio consultado SIN workspaceId falla en vez de filtrar datos', async () => {
    const ctxA = await makeAccount('A');
    const broken = { userId: ctxA.userId, role: 'OWNER' }; // sin workspaceId

    await expect(listMembers(broken)).rejects.toThrow(/tenant/i);
    await expect(getCurrentWorkspace(broken)).rejects.toThrow(/tenant/i);
    await expect(inviteMember(broken, { email: 'x@test.dev', role: 'MEMBER' })).rejects.toThrow(
      /tenant/i,
    );
  });
});
