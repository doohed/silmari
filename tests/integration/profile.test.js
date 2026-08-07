import { describe, it, expect } from 'vitest';
import { createAccount } from '@/lib/accounts/signup';
import { loginOrProvisionGoogleUser } from '@/lib/accounts/oauth';
import { authenticate } from '@/lib/accounts/authenticate';
import { changePassword, deleteAccount, getAccountProfile } from '@/lib/accounts/profile';
import WorkspaceMember from '@/models/WorkspaceMember';

async function emailCtx(email = 'prof@test.dev') {
  const { userId, workspaceId } = await createAccount({
    firstName: 'Prof',
    lastName: 'Uno',
    email,
    password: 'secret123',
    workspaceName: 'Prof Co',
  });
  return { userId, workspaceId, role: 'OWNER' };
}

describe('perfil: contraseña y borrado', () => {
  it('cambia la contraseña con la actual correcta', async () => {
    const ctx = await emailCtx('pwd@test.dev');
    await changePassword(ctx, { currentPassword: 'secret123', newPassword: 'nueva1234' });

    const session = await authenticate({ email: 'pwd@test.dev', password: 'nueva1234' });
    expect(session.userId).toBe(ctx.userId);
    await expect(authenticate({ email: 'pwd@test.dev', password: 'secret123' })).rejects.toThrow();
  });

  it('rechaza el cambio si la contraseña actual es incorrecta', async () => {
    const ctx = await emailCtx('pwd2@test.dev');
    await expect(
      changePassword(ctx, { currentPassword: 'mala', newPassword: 'nueva1234' }),
    ).rejects.toThrow(/actual/i);
  });

  it('una cuenta Google (sin contraseña) puede establecer una', async () => {
    const { session } = await loginOrProvisionGoogleUser({
      email: 'gp@test.dev',
      firstName: 'Grace',
      lastName: 'H',
      picture: null,
    });
    const ctx = { ...session, role: 'OWNER' };
    expect((await getAccountProfile(ctx)).hasPassword).toBe(false);

    await changePassword(ctx, { newPassword: 'googlepass1' });
    expect((await getAccountProfile(ctx)).hasPassword).toBe(true);
    const s = await authenticate({ email: 'gp@test.dev', password: 'googlepass1' });
    expect(s.userId).toBe(ctx.userId);
  });

  it('elimina la cuenta: quita membresías y bloquea el login', async () => {
    const ctx = await emailCtx('del@test.dev');
    await deleteAccount(ctx);

    expect(await WorkspaceMember.countDocuments({ userId: ctx.userId })).toBe(0);
    await expect(authenticate({ email: 'del@test.dev', password: 'secret123' })).rejects.toThrow();
  });
});
