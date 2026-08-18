import 'server-only';

/**
 * Driver de Resend sobre su API REST. Deliberadamente con `fetch` y sin el SDK:
 * es una única llamada HTTP y así no añadimos una dependencia (ni su cadena de
 * actualizaciones) por algo tan pequeño.
 *
 * @see https://resend.com/docs/api-reference/emails/send-email
 */

const ENDPOINT = 'https://api.resend.com/emails';

/**
 * @param {{ from: string, to: string, subject: string, html: string, text: string, replyTo?: string }} message
 * @returns {Promise<{ id: string }>}
 */
export async function sendWithResend(message) {
  const apiKey = process.env.RESEND_API_KEY;
  if (!apiKey) throw new Error('Falta RESEND_API_KEY');

  const res = await fetch(ENDPOINT, {
    method: 'POST',
    headers: {
      authorization: `Bearer ${apiKey}`,
      'content-type': 'application/json',
    },
    body: JSON.stringify({
      from: message.from,
      to: [message.to],
      subject: message.subject,
      html: message.html,
      text: message.text,
      ...(message.replyTo ? { reply_to: message.replyTo } : {}),
    }),
    // Un correo colgado no debe bloquear la petición del usuario.
    signal: AbortSignal.timeout(10_000),
  });

  const body = await res.json().catch(() => ({}));
  if (!res.ok) {
    // El mensaje de Resend es seguro para el log, pero nunca llega al usuario.
    throw new Error(`Resend respondió ${res.status}: ${body?.message ?? 'error desconocido'}`);
  }
  return { id: body?.id ?? '' };
}
