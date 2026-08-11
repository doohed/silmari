/**
 * Seam del proveedor de email saliente. **Hoy no hay proveedor conectado**: el
 * envío real requiere OAuth de Gmail/Outlook con credenciales del humano (igual
 * que el login con Google). Este módulo aísla ese punto para que el resto del
 * dominio (registrar comunicaciones, componer con plantillas) funcione y se
 * teste sin credenciales.
 *
 * Para habilitar el envío: implementa un proveedor con la forma
 *   { async send({ from, to, subject, body }): Promise<{ externalId: string }> }
 * y haz que `getEmailProvider(ctx)` lo devuelva (leyendo la cuenta conectada del
 * usuario/workspace). Ver «Pendientes conocidos» en CLAUDE.md.
 *
 * @param {import('@/lib/auth/permissions').Ctx} [ctx]
 * @returns {null | { send: (msg: { from:string, to:string[], subject:string, body:string }) => Promise<{ externalId: string }> }}
 */
export function getEmailProvider() {
  return null; // pendiente: conectar Gmail/Outlook
}

/** @returns {boolean} ¿Hay una cuenta de correo conectada para enviar? */
export function isEmailConfigured(ctx) {
  return getEmailProvider(ctx) != null;
}
