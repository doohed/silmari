import 'server-only';
import { sendWithResend } from '@/lib/mailer/resend';
import { appName } from '@/lib/config/app';
import { logger } from '@/lib/utils/logger';

/**
 * Remitente de sistema: los correos que manda **Silmari** (recuperar contraseña,
 * invitaciones, verificación de email).
 *
 * **No confundir con `lib/email/`**, que es el SMTP configurado por cada
 * workspace para que el usuario escriba a sus clientes desde la ficha. Son dos
 * cosas distintas y no comparten configuración a propósito: si un cliente
 * desconecta su SMTP, sus invitaciones deben seguir saliendo.
 *
 * Driver por `MAIL_PROVIDER`:
 * - `resend` (por defecto si hay `RESEND_API_KEY`) — envío real.
 * - `console` — no envía nada, escribe el correo en el log. Es el modo de
 *   desarrollo, para no depender de credenciales ni ensuciar bandejas.
 */

/** Remitente configurado, con un valor sensato en dev. */
function fromAddress() {
  return process.env.MAIL_FROM || `${appName()} <onboarding@resend.dev>`;
}

/** Driver activo. Sin API key caemos a `console` para no romper el flujo local. */
function provider() {
  const explicit = process.env.MAIL_PROVIDER;
  if (explicit) return explicit;
  return process.env.RESEND_API_KEY ? 'resend' : 'console';
}

/**
 * Envía un correo de sistema.
 *
 * **Nunca lanza.** Un fallo de correo no debe tumbar el registro ni la
 * invitación que lo dispara: se registra y se devuelve `ok: false`. Quien llama
 * decide si eso es relevante para el usuario (en el flujo de contraseña
 * olvidada, por ejemplo, no lo es: la respuesta debe ser idéntica siempre).
 *
 * @param {{ to: string, subject: string, html: string, text: string, replyTo?: string }} message
 * @returns {Promise<{ ok: boolean, id?: string, error?: string }>}
 */
export async function sendSystemEmail(message) {
  const driver = provider();
  const payload = { ...message, from: fromAddress() };

  try {
    if (driver === 'console') {
      logger.info('[mailer:console] correo no enviado (sin proveedor configurado)', {
        to: payload.to,
        subject: payload.subject,
        // El cuerpo en texto plano suele traer el enlace, que es justo lo que
        // necesitas para seguir el flujo en desarrollo.
        text: payload.text,
      });
      return { ok: true, id: 'console' };
    }

    if (driver === 'resend') {
      const { id } = await sendWithResend(payload);
      logger.info('Correo de sistema enviado', { to: payload.to, subject: payload.subject, id });
      return { ok: true, id };
    }

    throw new Error(`Proveedor de correo desconocido: ${driver}`);
  } catch (err) {
    logger.error('No se pudo enviar el correo de sistema', {
      to: payload.to,
      subject: payload.subject,
      message: err?.message,
    });
    return { ok: false, error: String(err?.message ?? err) };
  }
}

/** ¿Hay un proveedor real configurado? Útil para avisar en Ajustes. */
export function mailerIsConfigured() {
  return provider() !== 'console';
}
