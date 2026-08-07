import { describe, it, expect } from 'vitest';
import { createEmailAccount } from '@/lib/accounts/signup';
import { loginOrProvisionGoogleUser } from '@/lib/accounts/oauth';
import {
  getOnboardingState,
  saveWorkspaceStep,
  saveProfileStep,
  saveInviteStep,
  skipInviteStep,
  completePlanStep,
  finishOnboarding,
} from '@/lib/onboarding/service';
import { listMembers } from '@/lib/members/service';
import User from '@/models/User';
import WorkspaceMember from '@/models/WorkspaceMember';

async function newAccountCtx(email) {
  const { userId, workspaceId } = await createEmailAccount({ email, password: 'secret123' });
  return { userId, workspaceId, role: 'OWNER' };
}

describe('onboarding', () => {
  it('el alta por email arranca en WORKSPACE con workspace placeholder', async () => {
    const ctx = await newAccountCtx('nuevo@test.dev');
    const state = await getOnboardingState(ctx);
    expect(state.step).toBe('WORKSPACE');
    expect(state.workspace.name).toBe('Mi espacio de trabajo');
    expect(state.membersCount).toBe(1);
  });

  it('recorre los 5 pasos hasta DONE', async () => {
    const ctx = await newAccountCtx('flow@test.dev');

    await saveWorkspaceStep(ctx, { name: 'Acme Inc', subdomain: 'acme-inc' });
    expect((await User.findById(ctx.userId).lean()).onboardingStep).toBe('PROFILE');

    await saveProfileStep(ctx, {
      firstName: 'Ana',
      lastName: 'García',
      jobTitle: 'Directora comercial',
    });
    const member = await WorkspaceMember.findOne({
      workspaceId: ctx.workspaceId,
      userId: ctx.userId,
    }).lean();
    expect(member.jobTitle).toBe('Directora comercial');
    expect((await User.findById(ctx.userId).lean()).firstName).toBe('Ana');
    expect((await User.findById(ctx.userId).lean()).onboardingStep).toBe('INVITE');

    const { invites } = await saveInviteStep(ctx, { emails: ['tim@apple.com', 'phil@apple.com'] });
    expect(invites).toHaveLength(2);
    expect(invites[0].url).toContain('/invite/');
    expect((await User.findById(ctx.userId).lean()).onboardingStep).toBe('PLAN');

    await completePlanStep(ctx);
    expect((await User.findById(ctx.userId).lean()).onboardingStep).toBe('WELCOME');

    await finishOnboarding(ctx);
    expect((await User.findById(ctx.userId).lean()).onboardingStep).toBe('DONE');

    // El workspace refleja el nombre y subdominio elegidos.
    const state = await getOnboardingState(ctx);
    expect(state.workspace.name).toBe('Acme Inc');
    expect(state.workspace.slug).toBe('acme-inc');
  });

  it('rechaza un subdominio ya en uso', async () => {
    const a = await newAccountCtx('a@test.dev');
    const b = await newAccountCtx('b@test.dev');
    await saveWorkspaceStep(a, { name: 'Uno', subdomain: 'compartido' });
    await expect(saveWorkspaceStep(b, { name: 'Dos', subdomain: 'compartido' })).rejects.toThrow(
      /subdominio/i,
    );
  });

  it('permite saltar las invitaciones', async () => {
    const ctx = await newAccountCtx('skip@test.dev');
    await saveWorkspaceStep(ctx, { name: 'Skip', subdomain: 'skip-ws' });
    await saveProfileStep(ctx, { firstName: 'Sam' });
    await skipInviteStep(ctx);
    expect((await User.findById(ctx.userId).lean()).onboardingStep).toBe('PLAN');
  });

  it('Google: cuenta nueva aprovisiona y arranca onboarding; existente inicia sesión', async () => {
    const profile = {
      email: 'g@test.dev',
      firstName: 'Grace',
      lastName: 'Hopper',
      picture: null,
    };
    const first = await loginOrProvisionGoogleUser(profile);
    expect(first.isNew).toBe(true);
    const user = await User.findById(first.session.userId).lean();
    expect(user.authProvider).toBe('google');
    expect(user.passwordHash).toBeNull();
    expect(user.onboardingStep).toBe('WORKSPACE');

    const second = await loginOrProvisionGoogleUser(profile);
    expect(second.isNew).toBe(false);
    expect(second.session.userId).toBe(first.session.userId);
    expect(second.session.workspaceId).toBe(first.session.workspaceId);

    const members = await listMembers({ ...first.session, role: 'OWNER' });
    expect(members).toHaveLength(1);
  });
});
