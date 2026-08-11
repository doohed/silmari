/**
 * Seam del proveedor de WhatsApp. **Hoy no hay proveedor conectado**: requiere la
 * WhatsApp Cloud API de Meta (número, token y verificación del humano). Aísla ese
 * punto para que el dominio de comunicaciones funcione y se teste sin credenciales.
 *
 * Para habilitar el envío: implementa un proveedor con la forma
 *   { async send({ to, body, templateName? }): Promise<{ externalId: string }> }
 * y haz que `getWhatsappProvider(ctx)` lo devuelva. La recepción entrante seguirá
 * el patrón de `lib/leads` (webhook de Meta, workspaceId desde la credencial).
 * Ver «Pendientes conocidos» en CLAUDE.md.
 *
 * @param {import('@/lib/auth/permissions').Ctx} [ctx]
 * @returns {null | { send: (msg: { to:string, body:string }) => Promise<{ externalId: string }> }}
 */
export function getWhatsappProvider() {
  return null; // pendiente: conectar la WhatsApp Cloud API de Meta
}

/** @returns {boolean} ¿Hay un número de WhatsApp conectado para enviar? */
export function isWhatsappConfigured(ctx) {
  return getWhatsappProvider(ctx) != null;
}
