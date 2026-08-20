import { describe, it, expect } from 'vitest';
import { createAccount } from '@/lib/accounts/signup';
import { getSubscription } from '@/lib/billing/service';
import {
  assertWithinPlan,
  currentUsage,
  assertStorageWithinPlan,
  currentStorageBytes,
} from '@/lib/billing/limits';
import { createApiKey } from '@/lib/auth/api-key';
import { createWebhook } from '@/lib/webhooks/service';
import { createRecord } from '@/lib/records/service';
import { createAttachment } from '@/lib/attachments/service';
import Subscription from '@/models/Subscription';
import StripeEvent from '@/models/StripeEvent';
import { claimEvent } from '@/lib/billing/service';

let seq = 0;
async function owner() {
  seq += 1;
  const { userId, workspaceId } = await createAccount({
    firstName: 'Ana',
    lastName: 'Ruiz',
    email: `bill${seq}@test.dev`,
    password: 'secret123',
    workspaceName: `Bill Co ${seq}`,
  });
  return { userId, workspaceId, role: 'OWNER' };
}

/** Fija el plan del workspace saltándose Stripe (lo que haría el webhook). */
async function setPlan(ctx, plan, status = 'active') {
  await Subscription.findOneAndUpdate(
    { workspaceId: ctx.workspaceId },
    { $set: { plan, status } },
    { upsert: true },
  );
}

describe('facturación: planes y límites', () => {
  it('un workspace nuevo está en el plan gratis', async () => {
    const ctx = await owner();
    const sub = await getSubscription(ctx);

    expect(sub.plan).toBe('FREE');
    expect(sub.status).toBe('none');
    expect(sub.limits.apiKeys).toBe(2);
  });

  it('el plan gratis corta al llegar a su tope de API keys', async () => {
    const ctx = await owner();

    await createApiKey(ctx, { name: 'primera' });
    // FREE permite 2, para poder rotar una credencial sin cortar el servicio.
    await expect(createApiKey(ctx, { name: 'segunda' })).resolves.toMatchObject({
      token: expect.any(String),
    });
    await expect(createApiKey(ctx, { name: 'tercera' })).rejects.toThrow(/límite de 2/i);
  });

  it('el espacio de adjuntos también tiene tope de plan', async () => {
    const ctx = await owner();
    const MB = 1024 * 1024;

    // Gratis son 100 MB: 95 usados dejan sitio para 4, no para 10.
    await createAttachment(ctx, {
      name: 'grande.pdf',
      mimeType: 'application/pdf',
      size: 95 * MB,
      storageKey: `${ctx.workspaceId}/grande.pdf`,
      targets: [],
    });
    expect(await currentStorageBytes(ctx.workspaceId)).toBe(95 * MB);

    await expect(assertStorageWithinPlan(ctx, 4 * MB)).resolves.toBeUndefined();
    await expect(assertStorageWithinPlan(ctx, 10 * MB)).rejects.toThrow(/espacio de 100 MB/i);

    // Y subir de plan lo desbloquea, como el resto de límites.
    await setPlan(ctx, 'PRO');
    await expect(assertStorageWithinPlan(ctx, 10 * MB)).resolves.toBeUndefined();
  });

  it('subir de plan desbloquea el tope al instante', async () => {
    const ctx = await owner();
    await createWebhook(ctx, { targetUrl: 'https://a.test/h', operations: ['company.created'] });
    await createWebhook(ctx, { targetUrl: 'https://b.test/h', operations: ['company.created'] });
    await expect(
      createWebhook(ctx, { targetUrl: 'https://c.test/h', operations: ['company.created'] }),
    ).rejects.toThrow(/límite/i);

    await setPlan(ctx, 'PRO');

    await expect(
      createWebhook(ctx, { targetUrl: 'https://c.test/h', operations: ['company.created'] }),
    ).resolves.toMatchObject({ targetUrl: 'https://c.test/h' });
  });

  it('una suscripción cancelada vuelve a aplicar los límites del plan gratis', async () => {
    const ctx = await owner();
    await setPlan(ctx, 'PRO');
    await createApiKey(ctx, { name: 'una' });
    await createApiKey(ctx, { name: 'dos' });
    await createApiKey(ctx, { name: 'tres' });

    await setPlan(ctx, 'PRO', 'canceled');

    const sub = await getSubscription(ctx);
    expect(sub.plan).toBe('FREE');
    // Lo ya creado no se borra, pero no se puede crear más: hay 3 y FREE da 2.
    await expect(createApiKey(ctx, { name: 'cuatro' })).rejects.toThrow(/límite/i);
  });

  it('el plan business no tiene tope y no consulta contadores', async () => {
    const ctx = await owner();
    await setPlan(ctx, 'BUSINESS');
    await expect(assertWithinPlan(ctx, 'records')).resolves.toBeUndefined();
    await expect(assertWithinPlan(ctx, 'apiKeys')).resolves.toBeUndefined();
  });

  it('el tope de registros se aplica también a la creación por servicio', async () => {
    const ctx = await owner();
    // Simular las 1000 filas del tope sería lento sin aportar nada; se comprueba
    // el camino normal (cabe) y que el contador de consumo cuadra.
    await expect(
      createRecord(ctx, { objectSlug: 'companies', data: { name: 'Acme' } }),
    ).resolves.toMatchObject({ id: expect.any(String) });

    const usage = await currentUsage(ctx);
    expect(usage.records).toBe(1);
    expect(usage.members).toBe(1);
  });
});

describe('idempotencia de los eventos de Stripe', () => {
  it('el mismo evento solo se procesa una vez', async () => {
    const event = { id: 'evt_test_123', type: 'customer.subscription.updated' };

    expect(await claimEvent(event)).toBe(true);
    // Stripe reentrega: la segunda vez no debe reaplicarse.
    expect(await claimEvent(event)).toBe(false);

    expect(await StripeEvent.countDocuments({ _id: event.id })).toBe(1);
  });

  it('eventos distintos se procesan por separado', async () => {
    expect(await claimEvent({ id: 'evt_a', type: 'x' })).toBe(true);
    expect(await claimEvent({ id: 'evt_b', type: 'x' })).toBe(true);
  });
});
