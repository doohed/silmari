import { assertTenant } from '@/lib/services/tenant';
import { ValidationError } from '@/lib/errors/domain-errors';
import { logCommunication } from '@/lib/activities/service';
import { renderForRecord } from '@/lib/templates/service';
import { getEmailProvider } from '@/lib/email/provider';

/**
 * Registra un email **entrante** contra registros. Funciona ya (registro manual
 * de una conversación); también será el punto de volcado del sync cuando se
 * conecte una cuenta. Devuelve la actividad creada.
 * @param {import('@/lib/auth/permissions').Ctx} ctx
 * @param {{ from:string, to?:string|string[], subject?:string, body?:string,
 *   targets?:Array, externalId?:string, occurredAt?:string|Date }} input
 */
export async function recordInboundEmail(ctx, input) {
  assertTenant(ctx);
  return logCommunication(ctx, {
    channel: 'EMAIL',
    direction: 'INBOUND',
    from: input.from,
    to: input.to,
    subject: input.subject,
    body: input.body,
    provider: input.externalId ? 'CONNECTED' : 'MANUAL',
    externalId: input.externalId,
    occurredAt: input.occurredAt,
    targets: input.targets,
  });
}

/**
 * Envía un email **saliente**. Si se indica `templateId`, se renderiza contra el
 * registro (`objectSlug`/`recordId`). Sin una cuenta de correo conectada lanza un
 * error claro: **no finge enviar**. Cuando haya proveedor, envía y deja la
 * comunicación registrada en la ficha.
 * @param {import('@/lib/auth/permissions').Ctx} ctx
 * @param {{ to:string|string[], subject?:string, body?:string, targets?:Array,
 *   templateId?:string, objectSlug?:string, recordId?:string }} input
 */
export async function sendEmail(ctx, input) {
  assertTenant(ctx);
  let { subject, body } = input;
  if (input.templateId) {
    const rendered = await renderForRecord(ctx, {
      templateId: input.templateId,
      objectSlug: input.objectSlug,
      recordId: input.recordId,
    });
    subject = rendered.subject;
    body = rendered.body;
  }

  const provider = getEmailProvider(ctx);
  if (!provider) {
    throw new ValidationError(
      'Aún no hay una cuenta de correo conectada. Conecta Gmail u Outlook para enviar emails.',
    );
  }

  const to = Array.isArray(input.to) ? input.to : [input.to].filter(Boolean);
  const { externalId } = await provider.send({ from: ctx.userEmail ?? '', to, subject, body });
  return logCommunication(ctx, {
    channel: 'EMAIL',
    direction: 'OUTBOUND',
    to,
    subject,
    body,
    provider: 'CONNECTED',
    externalId,
    targets: input.targets,
  });
}
