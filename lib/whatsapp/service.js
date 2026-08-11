import { assertTenant } from '@/lib/services/tenant';
import { ValidationError } from '@/lib/errors/domain-errors';
import { logCommunication } from '@/lib/activities/service';
import { renderForRecord } from '@/lib/templates/service';
import { getWhatsappProvider } from '@/lib/whatsapp/provider';

/**
 * Registra un mensaje de WhatsApp **entrante** contra registros. Funciona ya
 * (registro manual); será también el punto de volcado del webhook de Meta cuando
 * se conecte un número.
 * @param {import('@/lib/auth/permissions').Ctx} ctx
 * @param {{ from:string, body?:string, targets?:Array, externalId?:string, occurredAt?:string|Date }} input
 */
export async function recordInboundMessage(ctx, input) {
  assertTenant(ctx);
  return logCommunication(ctx, {
    channel: 'WHATSAPP',
    direction: 'INBOUND',
    from: input.from,
    body: input.body,
    provider: input.externalId ? 'CONNECTED' : 'MANUAL',
    externalId: input.externalId,
    occurredAt: input.occurredAt,
    targets: input.targets,
  });
}

/**
 * Envía un mensaje de WhatsApp **saliente**. Con `templateId` se renderiza contra
 * el registro. Sin número conectado lanza un error claro (no finge enviar).
 * @param {import('@/lib/auth/permissions').Ctx} ctx
 * @param {{ to:string, body?:string, targets?:Array, templateId?:string, objectSlug?:string, recordId?:string }} input
 */
export async function sendWhatsapp(ctx, input) {
  assertTenant(ctx);
  let { body } = input;
  if (input.templateId) {
    const rendered = await renderForRecord(ctx, {
      templateId: input.templateId,
      objectSlug: input.objectSlug,
      recordId: input.recordId,
    });
    body = rendered.body;
  }

  const provider = getWhatsappProvider(ctx);
  if (!provider) {
    throw new ValidationError(
      'Aún no hay un número de WhatsApp conectado. Conecta la WhatsApp Cloud API para enviar mensajes.',
    );
  }

  const { externalId } = await provider.send({ to: input.to, body });
  return logCommunication(ctx, {
    channel: 'WHATSAPP',
    direction: 'OUTBOUND',
    to: input.to,
    body,
    provider: 'CONNECTED',
    externalId,
    targets: input.targets,
  });
}
