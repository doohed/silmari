import { describe, it, expect } from 'vitest';
import { createAccount } from '@/lib/accounts/signup';
import {
  saveEmailConnection,
  getEmailConnection,
  deleteEmailConnection,
  loadEmailConfig,
  saveWhatsappConnection,
  loadWhatsappConfig,
} from '@/lib/integrations/service';
import { getEmailProvider } from '@/lib/email/provider';
import { getWhatsappProvider } from '@/lib/whatsapp/provider';
import { sendEmail } from '@/lib/email/service';

let seq = 0;

async function owner() {
  seq += 1;
  const { userId, workspaceId } = await createAccount({
    firstName: 'Int',
    lastName: 'User',
    email: `int${seq}@test.dev`,
    password: 'secret123',
    workspaceName: `Int Co ${seq}`,
  });
  return { userId, workspaceId, role: 'OWNER' };
}

describe('integraciones · email SMTP', () => {
  it('un MEMBER no puede gestionarlas', async () => {
    const ctx = await owner();
    const mem = { ...ctx, role: 'MEMBER' };
    await expect(getEmailConnection(mem)).rejects.toThrow();
    await expect(
      saveEmailConnection(mem, { host: 'x', user: 'a@b.com', password: 'p' }),
    ).rejects.toThrow();
  });

  it('guarda la conexión sin exponer la contraseña, y la carga descifrada', async () => {
    const ctx = await owner();
    const dto = await saveEmailConnection(ctx, {
      host: 'smtp.gmail.com',
      port: 587,
      user: 'yo@gmail.com',
      password: 'app-pass-123',
      fromName: 'Yo',
    });
    expect(dto.connected).toBe(true);
    expect(dto.host).toBe('smtp.gmail.com');
    expect(dto).not.toHaveProperty('secret');
    expect(dto).not.toHaveProperty('password');

    const cfg = await loadEmailConfig(ctx);
    expect(cfg.auth.pass).toBe('app-pass-123'); // descifrada
    expect(cfg.from).toBe('Yo <yo@gmail.com>');
  });

  it('actualizar sin contraseña conserva la anterior', async () => {
    const ctx = await owner();
    await saveEmailConnection(ctx, { host: 'h', user: 'u@x.com', password: 'orig' });
    await saveEmailConnection(ctx, { host: 'h2', user: 'u@x.com' }); // sin password
    const cfg = await loadEmailConfig(ctx);
    expect(cfg.host).toBe('h2');
    expect(cfg.auth.pass).toBe('orig');
  });

  it('crear sin contraseña la primera vez falla', async () => {
    const ctx = await owner();
    await expect(saveEmailConnection(ctx, { host: 'h', user: 'u@x.com' })).rejects.toThrow(
      /contraseña/i,
    );
  });

  it('getEmailProvider: null sin conexión, provider con conexión', async () => {
    const ctx = await owner();
    expect(await getEmailProvider(ctx)).toBeNull();
    await saveEmailConnection(ctx, { host: 'h', user: 'u@x.com', password: 'p' });
    const provider = await getEmailProvider(ctx);
    expect(provider).toBeTruthy();
    expect(typeof provider.send).toBe('function');
  });

  it('sendEmail sigue avisando si no hay conexión', async () => {
    const ctx = await owner();
    await expect(sendEmail(ctx, { to: 'x@y.com', subject: 's', body: 'b' })).rejects.toThrow(
      /cuenta de correo conectada/i,
    );
  });

  it('desconectar elimina la conexión', async () => {
    const ctx = await owner();
    await saveEmailConnection(ctx, { host: 'h', user: 'u@x.com', password: 'p' });
    await deleteEmailConnection(ctx);
    expect((await getEmailConnection(ctx)).connected).toBe(false);
    expect(await loadEmailConfig(ctx)).toBeNull();
  });
});

describe('integraciones · whatsapp', () => {
  it('guarda y carga el token descifrado; el proveedor se construye', async () => {
    const ctx = await owner();
    const dto = await saveWhatsappConnection(ctx, {
      phoneNumberId: '123456',
      accessToken: 'EAAG-secret',
    });
    expect(dto.connected).toBe(true);
    expect(dto.phoneNumberId).toBe('123456');
    expect(dto).not.toHaveProperty('secret');

    const cfg = await loadWhatsappConfig(ctx);
    expect(cfg.accessToken).toBe('EAAG-secret');

    const provider = await getWhatsappProvider(ctx);
    expect(typeof provider.send).toBe('function');
  });

  it('aísla por workspace', async () => {
    const a = await owner();
    const b = await owner();
    await saveWhatsappConnection(a, { phoneNumberId: '111', accessToken: 't' });
    expect(await loadWhatsappConfig(b)).toBeNull();
  });
});
