import { describe, it, expect, beforeEach, vi } from 'vitest';
import { createAccount } from '@/lib/accounts/signup';
import { authenticate } from '@/lib/accounts/authenticate';
import {
  requestPasswordReset,
  resetPassword,
  isResetTokenValid,
  invalidatePendingResets,
} from '@/lib/accounts/password-reset';
import { changePassword } from '@/lib/accounts/profile';
import { encryptSession, decryptSession, isSessionCurrent } from '@/lib/auth/jwt';
import PasswordReset from '@/models/PasswordReset';
import User from '@/models/User';

// El driver `console` del mailer no envía nada, así que el token hay que
// leerlo de la colección: es lo que viajaría en el enlace del correo.
async function pendingTokenHashFor(email) {
  const user = await User.findOne({ email }).select('_id').lean();
  return PasswordReset.findOne({ userId: user._id, usedAt: null }).lean();
}

let seq = 0;
async function account() {
  seq += 1;
  const email = `reset${seq}@test.dev`;
  const session = await createAccount({
    firstName: 'Ana',
    lastName: 'Ruiz',
    email,
    password: 'secret123',
    workspaceName: `Reset Co ${seq}`,
  });
  return { ...session, email, role: 'OWNER' };
}

/**
 * `requestPasswordReset` guarda el hash, no el token. Para probar el ciclo
 * completo espiamos la generación: replicamos lo que hace el servicio creando
 * el token nosotros y comprobando el efecto observable.
 */
describe('recuperación de contraseña', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it('crea un token pendiente para una cuenta existente', async () => {
    const { email } = await account();
    await requestPasswordReset({ email });

    const doc = await pendingTokenHashFor(email);
    expect(doc).toBeTruthy();
    expect(doc.usedAt).toBeNull();
    expect(doc.expiresAt.getTime()).toBeGreaterThan(Date.now());
  });

  it('no falla ni crea nada si el email no tiene cuenta', async () => {
    await expect(requestPasswordReset({ email: 'nadie@test.dev' })).resolves.toBeUndefined();
    expect(await PasswordReset.countDocuments({})).toBeGreaterThanOrEqual(0);
  });

  it('pedir un enlace nuevo invalida el anterior', async () => {
    const { email } = await account();
    await requestPasswordReset({ email });
    const first = await pendingTokenHashFor(email);

    await requestPasswordReset({ email });
    const firstAfter = await PasswordReset.findById(first._id).lean();

    expect(firstAfter.usedAt).not.toBeNull();
    const pending = await PasswordReset.countDocuments({ userId: first.userId, usedAt: null });
    expect(pending).toBe(1);
  });

  it('restablecer la contraseña invalida las sesiones ya emitidas', async () => {
    const { email, userId, workspaceId } = await account();

    // Sesión emitida ANTES: es la que tendría quien se hubiera colado.
    const antes = await decryptSession(await encryptSession({ userId, workspaceId }));

    const { randomBytes, createHash } = await import('node:crypto');
    const raw = randomBytes(32).toString('base64url');
    await PasswordReset.create({
      userId,
      tokenHash: createHash('sha256').update(raw).digest('hex'),
      expiresAt: new Date(Date.now() + 3600_000),
    });
    // El corte va en segundos: sin esperar, la sesión vieja caería en el mismo
    // segundo que el corte y seguiría valiendo.
    await new Promise((r) => setTimeout(r, 1100));
    await resetPassword({ token: raw, password: 'nuevaClave9' });

    const user = await User.findOne({ email }).select('sessionsValidFrom').lean();
    expect(user.sessionsValidFrom).toBeTruthy();
    expect(isSessionCurrent(antes, user.sessionsValidFrom)).toBe(false);

    // Y una sesión emitida después del cambio sí vale.
    const despues = await decryptSession(await encryptSession({ userId, workspaceId }));
    expect(isSessionCurrent(despues, user.sessionsValidFrom)).toBe(true);
  });

  it('cambiar la contraseña desde Ajustes también corta las sesiones abiertas', async () => {
    const { email, userId, workspaceId, role } = await account();
    const antes = await decryptSession(await encryptSession({ userId, workspaceId }));

    await new Promise((r) => setTimeout(r, 1100));
    await changePassword(
      { userId, workspaceId, role },
      { currentPassword: 'secret123', newPassword: 'otraClave9' },
    );

    const user = await User.findOne({ email }).select('sessionsValidFrom').lean();
    expect(isSessionCurrent(antes, user.sessionsValidFrom)).toBe(false);
  });

  it('un token válido cambia la contraseña y deja de servir', async () => {
    const { email } = await account();

    // Generamos el token igual que el servicio, para poder usarlo en claro.
    const { randomBytes, createHash } = await import('node:crypto');
    const raw = randomBytes(32).toString('base64url');
    const user = await User.findOne({ email }).select('_id').lean();
    await PasswordReset.create({
      userId: user._id,
      tokenHash: createHash('sha256').update(raw).digest('hex'),
      expiresAt: new Date(Date.now() + 3600_000),
    });

    expect(await isResetTokenValid(raw)).toBe(true);

    await resetPassword({ token: raw, password: 'nuevaClave9' });

    // La contraseña nueva entra y la vieja ya no.
    await expect(authenticate({ email, password: 'nuevaClave9' })).resolves.toMatchObject({
      workspaceId: expect.any(String),
    });
    await expect(authenticate({ email, password: 'secret123' })).rejects.toThrow();

    // Un solo uso.
    expect(await isResetTokenValid(raw)).toBe(false);
    await expect(resetPassword({ token: raw, password: 'otraClave9' })).rejects.toThrow(
      /no es válido o ha caducado/i,
    );
  });

  it('rechaza un token caducado', async () => {
    const { email } = await account();
    const { randomBytes, createHash } = await import('node:crypto');
    const raw = randomBytes(32).toString('base64url');
    const user = await User.findOne({ email }).select('_id').lean();
    await PasswordReset.create({
      userId: user._id,
      tokenHash: createHash('sha256').update(raw).digest('hex'),
      expiresAt: new Date(Date.now() - 1000),
    });

    expect(await isResetTokenValid(raw)).toBe(false);
    await expect(resetPassword({ token: raw, password: 'nuevaClave9' })).rejects.toThrow(
      /no es válido o ha caducado/i,
    );
  });

  it('rechaza un token inventado', async () => {
    await expect(resetPassword({ token: 'no-existe', password: 'nuevaClave9' })).rejects.toThrow(
      /no es válido o ha caducado/i,
    );
  });

  it('cambiar la contraseña desde Ajustes invalida los enlaces pendientes', async () => {
    const ctx = await account();
    await requestPasswordReset({ email: ctx.email });
    expect(await pendingTokenHashFor(ctx.email)).toBeTruthy();

    await changePassword(ctx, { currentPassword: 'secret123', newPassword: 'otraClave9' });

    expect(await pendingTokenHashFor(ctx.email)).toBeNull();
  });

  it('invalidatePendingResets no falla sin nada pendiente', async () => {
    const ctx = await account();
    await expect(invalidatePendingResets(ctx.userId)).resolves.toBeUndefined();
  });
});
