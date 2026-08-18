/**
 * Plantillas del correo transaccional. Módulo **puro**: recibe datos y devuelve
 * `{ subject, html, text }`, sin tocar entorno ni red, para poder testearlo.
 *
 * HTML con estilos en línea y tablas a propósito: los clientes de correo no
 * soportan hojas de estilo modernas. No se reutilizan los tokens de
 * `globals.css` porque en un email no existen.
 */

const BRAND = '#4f46e5';
const TEXT = '#111827';
const MUTED = '#6b7280';
const BORDER = '#e5e7eb';

/** Envoltorio común: cabecera con la marca, cuerpo y pie. */
function layout({ appName, title, bodyHtml, footerHtml = '' }) {
  return `<!doctype html>
<html lang="es">
  <head><meta charset="utf-8"><meta name="viewport" content="width=device-width"><title>${escapeHtml(title)}</title></head>
  <body style="margin:0;padding:0;background:#f9fafb;">
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#f9fafb;padding:32px 16px;">
      <tr><td align="center">
        <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:480px;background:#ffffff;border:1px solid ${BORDER};border-radius:12px;padding:32px;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,Helvetica,Arial,sans-serif;">
          <tr><td style="padding-bottom:24px;font-size:18px;font-weight:600;color:${TEXT};">${escapeHtml(appName)}</td></tr>
          <tr><td style="font-size:15px;line-height:1.6;color:${TEXT};">${bodyHtml}</td></tr>
          <tr><td style="padding-top:28px;border-top:1px solid ${BORDER};margin-top:28px;font-size:12px;line-height:1.6;color:${MUTED};">
            ${footerHtml || `Te enviamos este correo porque tienes una cuenta en ${escapeHtml(appName)}.`}
          </td></tr>
        </table>
      </td></tr>
    </table>
  </body>
</html>`;
}

/** Botón de acción (tabla, no `<a>` suelto: Outlook lo rompe). */
function button(url, label) {
  return `<table role="presentation" cellpadding="0" cellspacing="0" style="margin:24px 0;">
    <tr><td style="background:${BRAND};border-radius:8px;">
      <a href="${escapeHtml(url)}" style="display:inline-block;padding:12px 24px;font-size:14px;font-weight:600;color:#ffffff;text-decoration:none;">${escapeHtml(label)}</a>
    </td></tr>
  </table>`;
}

/** Escapa el texto que se interpola en el HTML del correo. */
function escapeHtml(value) {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

/**
 * Restablecer contraseña.
 * @param {{ appName: string, url: string, expiresInMinutes: number }} data
 */
export function passwordResetEmail({ appName, url, expiresInMinutes }) {
  const subject = `Restablece tu contraseña de ${appName}`;
  const bodyHtml = `
    <p style="margin:0 0 16px;">Hemos recibido una solicitud para restablecer la contraseña de tu cuenta.</p>
    ${button(url, 'Elegir una contraseña nueva')}
    <p style="margin:0;color:${MUTED};font-size:13px;">El enlace caduca en ${expiresInMinutes} minutos y solo se puede usar una vez.</p>`;
  const text = [
    'Hemos recibido una solicitud para restablecer la contraseña de tu cuenta.',
    '',
    url,
    '',
    `El enlace caduca en ${expiresInMinutes} minutos y solo se puede usar una vez.`,
    'Si no has sido tú, puedes ignorar este correo: tu contraseña no cambiará.',
  ].join('\n');

  return {
    subject,
    text,
    html: layout({
      appName,
      title: subject,
      bodyHtml,
      footerHtml:
        'Si no has sido tú, puedes ignorar este correo: tu contraseña no cambiará. ' +
        'No compartas este enlace con nadie.',
    }),
  };
}

/**
 * Verificación de la dirección de email al registrarse.
 * @param {{ appName: string, url: string, expiresInDays: number }} data
 */
export function emailVerificationEmail({ appName, url, expiresInDays }) {
  const subject = `Confirma tu email en ${appName}`;
  const bodyHtml = `
    <p style="margin:0 0 16px;">Solo queda un paso: confirma que esta dirección es tuya.</p>
    ${button(url, 'Confirmar mi email')}
    <p style="margin:0;color:${MUTED};font-size:13px;">El enlace caduca en ${expiresInDays} días.</p>`;
  const text = [
    'Solo queda un paso: confirma que esta dirección es tuya.',
    '',
    url,
    '',
    `El enlace caduca en ${expiresInDays} días.`,
  ].join('\n');

  return {
    subject,
    text,
    html: layout({
      appName,
      title: subject,
      bodyHtml,
      footerHtml: `Si no te has registrado en ${escapeHtml(appName)}, ignora este correo.`,
    }),
  };
}

/**
 * Invitación a un espacio de trabajo.
 * @param {{ appName: string, url: string, workspaceName: string, inviterName?: string, expiresInDays: number }} data
 */
export function invitationEmail({ appName, url, workspaceName, inviterName, expiresInDays }) {
  const who = inviterName ? `${inviterName} te ha invitado` : 'Te han invitado';
  const subject = `${who} a ${workspaceName} en ${appName}`;
  const bodyHtml = `
    <p style="margin:0 0 16px;">${escapeHtml(who)} a unirte al espacio de trabajo <strong>${escapeHtml(workspaceName)}</strong>.</p>
    ${button(url, 'Aceptar la invitación')}
    <p style="margin:0;color:${MUTED};font-size:13px;">La invitación caduca en ${expiresInDays} días.</p>`;
  const text = [
    `${who} a unirte al espacio de trabajo ${workspaceName}.`,
    '',
    url,
    '',
    `La invitación caduca en ${expiresInDays} días.`,
  ].join('\n');

  return {
    subject,
    text,
    html: layout({
      appName,
      title: subject,
      bodyHtml,
      footerHtml: 'Si no esperabas esta invitación, puedes ignorar este correo.',
    }),
  };
}
