import { describe, it, expect } from 'vitest';
import { loginOrProvisionOAuthUser } from '@/lib/accounts/oauth';
import User from '@/models/User';

let seq = 0;
function profile(provider) {
  seq += 1;
  return {
    email: `${provider}${seq}@test.dev`,
    firstName: 'Nom',
    lastName: 'Bre',
    picture: null,
  };
}

describe('aprovisionamiento OAuth (Google + Microsoft)', () => {
  it('Microsoft: cuenta nueva aprovisiona y arranca onboarding; existente inicia sesión', async () => {
    const p = profile('microsoft');

    const first = await loginOrProvisionOAuthUser(p, 'microsoft');
    expect(first.isNew).toBe(true);
    expect(first.session.userId).toBeTruthy();
    expect(first.session.workspaceId).toBeTruthy();

    const user = await User.findById(first.session.userId).lean();
    expect(user.authProvider).toBe('microsoft');

    const second = await loginOrProvisionOAuthUser(p, 'microsoft');
    expect(second.isNew).toBe(false);
    expect(second.session.userId).toBe(first.session.userId);
  });

  it('un mismo email es una sola cuenta aunque cambie el proveedor', async () => {
    const p = profile('google');
    const viaGoogle = await loginOrProvisionOAuthUser(p, 'google');
    expect(viaGoogle.isNew).toBe(true);

    const viaMicrosoft = await loginOrProvisionOAuthUser(p, 'microsoft');
    expect(viaMicrosoft.isNew).toBe(false);
    expect(viaMicrosoft.session.userId).toBe(viaGoogle.session.userId);
  });
});
