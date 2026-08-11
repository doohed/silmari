import nodemailer from 'nodemailer';
import { loadEmailConfig } from '@/lib/integrations/service';

/**
 * Proveedor de email saliente por **SMTP**. Lee la conexión del workspace
 * (Ajustes → Integraciones); si no hay ninguna activa, devuelve `null` y el
 * envío avisa de que falta conectar una cuenta. El `from` es siempre el de la
 * cuenta conectada (los servidores SMTP rechazan remitentes arbitrarios).
 *
 * @param {import('@/lib/auth/permissions').Ctx} ctx
 * @returns {Promise<null | { send: (msg: { to:string[], subject:string, body:string }) => Promise<{ externalId: string }> }>}
 */
export async function getEmailProvider(ctx) {
  const cfg = await loadEmailConfig(ctx);
  if (!cfg) return null;

  const transporter = nodemailer.createTransport({
    host: cfg.host,
    port: cfg.port,
    secure: cfg.secure,
    auth: cfg.auth,
  });

  return {
    async send({ to, subject, body }) {
      const info = await transporter.sendMail({
        from: cfg.from,
        to: Array.isArray(to) ? to.join(', ') : to,
        subject: subject ?? '',
        text: body ?? '',
      });
      return { externalId: info.messageId ?? '' };
    },
  };
}

/** @returns {Promise<boolean>} ¿Hay una cuenta de correo conectada para enviar? */
export async function isEmailConfigured(ctx) {
  return (await loadEmailConfig(ctx)) != null;
}
