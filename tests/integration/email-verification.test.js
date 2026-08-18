import { describe, it, expect } from 'vitest';
import { randomBytes, createHash } from 'node:crypto';
import { createAccount, createEmailAccount } from '@/lib/accounts/signup';
import {
  verifyEmailToken,
  resendEmailVerification,
  isEmailVerified,
  assertEmailVerified,
} from '@/lib/accounts/email-verification';
import { createApiKey } from '@/lib/auth/api-key';
import { createWebhook } from '@/lib/webhooks/service';
import { createInvitation, acceptInvitation } from '@/lib/invitations/service';
import EmailVerification from '@/models/EmailVerification';
import User from '@/models/User';

let seq = 0;

/** Cuenta por el flujo público de `/signup`: nace SIN confirmar. */
async function publicSignup() {
  seq += 1;
  const email = `verify${seq}@test.dev`;
  const session = await createEmailAccount({ email, password: 'secret123' });
  return { ...session, email, role: 'OWNER' };
}

/** Cuenta de test/seed: nace confirmada, para no romper el resto de la suite. */
async function seededAccount() {
  seq += 1;
  const email = `seed${seq}@test.dev`;
  const session = await createAccount({
    firstName: 'Ana',
    lastName: 'Ruiz',
    email,
    password: 'secret123',
    workspaceName: `Verify Co ${seq}`,
  });
  return { ...session, email, role: 'OWNER' };
}

/** Emite un token igual que el servicio, para poder usarlo en claro. */
async function issueToken(userId, email, { expiresAt } = {}) {
  const raw = randomBytes(32).toString('base64url');
  await EmailVerification.create({
    userId,
    email,
    tokenHash: createHash('sha256').update(raw).digest('hex'),
    expiresAt: expiresAt ?? new Date(Date.now() + 86400_000),
  });
  return raw;
}

describe('verificación de email', () => {
  it('el alta pública nace sin confirmar y con un token pendiente', async () => {
    const ctx = await publicSignup();

    expect(await isEmailVerified(ctx)).toBe(false);
    const pending = await EmailVerification.findOne({ userId: ctx.userId, usedAt: null }).lean();
    expect(pending).toBeTruthy();
    expect(pending.email).toBe(ctx.email);
  });

  it('las cuentas de seed/test nacen confirmadas', async () => {
    const ctx = await seededAccount();
    expect(await isEmailVerified(ctx)).toBe(true);
  });

  it('un token válido confirma la cuenta y no se puede reutilizar', async () => {
    const ctx = await publicSignup();
    const raw = await issueToken(ctx.userId, ctx.email);

    await verifyEmailToken(raw);
    expect(await isEmailVerified(ctx)).toBe(true);

    await expect(verifyEmailToken(raw)).rejects.toThrow(/no es válido o ha caducado/i);
  });

  it('rechaza un token caducado y uno inventado', async () => {
    const ctx = await publicSignup();
    const expired = await issueToken(ctx.userId, ctx.email, {
      expiresAt: new Date(Date.now() - 1000),
    });

    await expect(verifyEmailToken(expired)).rejects.toThrow(/no es válido o ha caducado/i);
    await expect(verifyEmailToken('inventado')).rejects.toThrow(/no es válido o ha caducado/i);
  });

  it('un token deja de valer si la cuenta cambió de dirección', async () => {
    const ctx = await publicSignup();
    const raw = await issueToken(ctx.userId, ctx.email);

    await User.updateOne({ _id: ctx.userId }, { $set: { email: `otro${seq}@test.dev` } });

    await expect(verifyEmailToken(raw)).rejects.toThrow(/era para otra dirección/i);
  });

  it('el reenvío invalida el token anterior y respeta el enfriamiento', async () => {
    const ctx = await publicSignup();
    const first = await EmailVerification.findOne({ userId: ctx.userId, usedAt: null }).lean();

    // El alta acaba de enviar uno: el reenvío inmediato se frena.
    await expect(resendEmailVerification(ctx)).rejects.toThrow(/Espera un minuto/i);

    // Con el envío anterior fuera de la ventana, sí reenvía. Se retrocede por el
    // driver crudo: Mongoose marca `createdAt` como inmutable y descarta el $set.
    await EmailVerification.collection.updateOne(
      { _id: first._id },
      { $set: { createdAt: new Date(Date.now() - 120_000) } },
    );
    await expect(resendEmailVerification(ctx)).resolves.toEqual({ sent: true });

    const firstAfter = await EmailVerification.findById(first._id).lean();
    expect(firstAfter.usedAt).not.toBeNull();
  });

  it('no reenvía si ya está confirmado', async () => {
    const ctx = await seededAccount();
    await expect(resendEmailVerification(ctx)).resolves.toEqual({ sent: false });
  });

  it('bloquea invitar, API keys y webhooks sin confirmar', async () => {
    const ctx = await publicSignup();

    await expect(createInvitation(ctx, { email: 'x@test.dev', role: 'MEMBER' })).rejects.toThrow(
      /Confirma tu email/i,
    );
    await expect(createApiKey(ctx, { name: 'k' })).rejects.toThrow(/Confirma tu email/i);
    await expect(
      createWebhook(ctx, { targetUrl: 'https://x.test/h', operations: ['company.created'] }),
    ).rejects.toThrow(/Confirma tu email/i);
  });

  it('las permite en cuanto se confirma', async () => {
    const ctx = await publicSignup();
    const raw = await issueToken(ctx.userId, ctx.email);
    await verifyEmailToken(raw);

    await expect(createApiKey(ctx, { name: 'k' })).resolves.toMatchObject({
      token: expect.any(String),
    });
  });

  it('no exige confirmación a una API key (no tiene buzón)', async () => {
    const apiCtx = { userId: 'apikey:507f1f77bcf86cd799439011', workspaceId: 'w', role: 'MEMBER' };
    await expect(assertEmailVerified(apiCtx)).resolves.toBeUndefined();
  });

  it('aceptar una invitación deja la cuenta confirmada', async () => {
    const inviter = await seededAccount();
    seq += 1;
    const invitedEmail = `invitado${seq}@test.dev`;
    const { token } = await createInvitation(inviter, { email: invitedEmail, role: 'MEMBER' });

    const session = await acceptInvitation({
      token,
      firstName: 'Luis',
      lastName: 'Paz',
      password: 'secret123',
    });

    expect(await isEmailVerified(session)).toBe(true);
  });
});
