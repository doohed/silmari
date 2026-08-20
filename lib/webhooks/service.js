import { randomBytes, createHmac } from 'node:crypto';
import { connectToDatabase } from '@/lib/db/connect';
import { assertTenant } from '@/lib/services/tenant';
import { can } from '@/lib/auth/permissions';
import { assertEmailVerified } from '@/lib/accounts/email-verification';
import { assertWithinPlan } from '@/lib/billing/limits';
import { ForbiddenError, NotFoundError } from '@/lib/errors/domain-errors';
import { assertPublicUrl } from '@/lib/http/safe-url';
import { logger } from '@/lib/utils/logger';
import Webhook from '@/models/Webhook';

const MAX_LOG = 20;

function toWebhookDTO(w) {
  return {
    id: String(w._id),
    targetUrl: w.targetUrl,
    operations: w.operations,
    secret: w.secret,
    isActive: w.isActive,
    deliveryLog: (w.deliveryLog ?? [])
      .slice()
      .reverse()
      .map((d) => ({
        id: String(d._id),
        operation: d.operation,
        ok: d.ok,
        statusCode: d.statusCode ?? null,
        error: d.error ?? null,
        at: d.at,
      })),
  };
}

/** Crea un webhook. */
export async function createWebhook(ctx, { targetUrl, operations }) {
  assertTenant(ctx);
  if (!can(ctx, 'webhooks:manage')) throw new ForbiddenError('No puedes gestionar webhooks');
  // Un webhook saca datos del workspace a una URL arbitraria: email confirmado.
  await assertEmailVerified(ctx);
  await assertWithinPlan(ctx, 'webhooks');
  // No basta con que sea una URL: no puede apuntar a nuestra propia red.
  await assertPublicUrl(targetUrl);
  await connectToDatabase();
  const doc = await Webhook.create({
    workspaceId: ctx.workspaceId,
    targetUrl,
    operations: operations ?? [],
    secret: `whsec_${randomBytes(16).toString('hex')}`,
  });
  return toWebhookDTO(doc);
}

/** Lista los webhooks del workspace. */
export async function listWebhooks(ctx) {
  assertTenant(ctx);
  if (!can(ctx, 'webhooks:manage')) throw new ForbiddenError('No puedes gestionar webhooks');
  await connectToDatabase();
  const items = await Webhook.find({ workspaceId: ctx.workspaceId }).sort({ createdAt: -1 });
  return items.map(toWebhookDTO);
}

/** Borra un webhook. */
export async function deleteWebhook(ctx, id) {
  assertTenant(ctx);
  if (!can(ctx, 'webhooks:manage')) throw new ForbiddenError('No puedes gestionar webhooks');
  await connectToDatabase();
  const w = await Webhook.findOne({ _id: id, workspaceId: ctx.workspaceId });
  if (!w) throw new NotFoundError('Webhook no encontrado');
  await w.deleteOne();
}

/**
 * Entrega un payload a un webhook y registra el resultado.
 *
 * El destino se revalida aquí, no solo al guardarlo: entre una cosa y otra el
 * DNS puede haber cambiado a una dirección interna (rebinding). Y las
 * redirecciones no se siguen (`redirect: 'manual'`), porque un destino público
 * podría contestar con un 302 hacia `169.254.169.254` y saltarse todo lo
 * anterior.
 */
async function deliver(webhook, operation, body) {
  const signature = createHmac('sha256', webhook.secret).update(body).digest('hex');
  const entry = { operation, requestBody: body, at: new Date() };
  try {
    await assertPublicUrl(webhook.targetUrl);
    const res = await fetch(webhook.targetUrl, {
      method: 'POST',
      headers: { 'content-type': 'application/json', 'x-silmari-signature': signature },
      body,
      redirect: 'manual',
      signal: AbortSignal.timeout(5000),
    });
    if (res.status >= 300 && res.status < 400) {
      entry.ok = false;
      entry.statusCode = res.status;
      entry.error = 'El destino respondió con una redirección, que no se sigue';
    } else {
      entry.ok = res.ok;
      entry.statusCode = res.status;
      entry.responseSnippet = (await res.text().catch(() => '')).slice(0, 500);
    }
  } catch (err) {
    entry.ok = false;
    entry.error = String(err?.message ?? err).slice(0, 300);
  }
  webhook.deliveryLog.push(entry);
  if (webhook.deliveryLog.length > MAX_LOG) {
    webhook.deliveryLog = webhook.deliveryLog.slice(-MAX_LOG);
  }
  await webhook.save();
  return entry;
}

/**
 * Despacha un evento a los webhooks activos suscritos. Fire-and-forget: nunca
 * bloquea ni hace fallar la mutación que lo dispara.
 * @param {import('@/lib/auth/permissions').Ctx} ctx
 * @param {{ operation: string, payload: any }} args
 */
export async function dispatchWebhooks(ctx, { operation, payload }) {
  try {
    await connectToDatabase();
    const hooks = await Webhook.find({
      workspaceId: ctx.workspaceId,
      isActive: true,
      operations: operation,
    });
    const body = JSON.stringify({ operation, data: payload, at: new Date().toISOString() });
    await Promise.all(hooks.map((h) => deliver(h, operation, body)));
  } catch (err) {
    logger.error('Fallo despachando webhooks', err);
  }
}

/** Reintenta una entrega registrada. */
export async function retryDelivery(ctx, { webhookId, deliveryId }) {
  assertTenant(ctx);
  if (!can(ctx, 'webhooks:manage')) throw new ForbiddenError('No puedes gestionar webhooks');
  await connectToDatabase();
  const w = await Webhook.findOne({ _id: webhookId, workspaceId: ctx.workspaceId });
  if (!w) throw new NotFoundError('Webhook no encontrado');
  const delivery = w.deliveryLog.id(deliveryId);
  if (!delivery) throw new NotFoundError('Entrega no encontrada');
  await deliver(w, delivery.operation, delivery.requestBody);
  return toWebhookDTO(w);
}
