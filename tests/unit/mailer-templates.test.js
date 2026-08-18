import { describe, it, expect } from 'vitest';
import { passwordResetEmail, invitationEmail } from '@/lib/mailer/templates';

describe('plantillas de correo', () => {
  it('el correo de contraseña lleva el enlace en HTML y en texto plano', () => {
    const url = 'https://app.silmari.test/reset/abc123';
    const mail = passwordResetEmail({ appName: 'Silmari', url, expiresInMinutes: 60 });

    expect(mail.subject).toContain('Silmari');
    expect(mail.html).toContain(url);
    // El texto plano importa: hay clientes que no pintan HTML.
    expect(mail.text).toContain(url);
    expect(mail.text).toContain('60 minutos');
  });

  it('el correo de invitación nombra a quien invita y al espacio de trabajo', () => {
    const mail = invitationEmail({
      appName: 'Silmari',
      url: 'https://app.silmari.test/invite/xyz',
      workspaceName: 'Acme',
      inviterName: 'Ana Ruiz',
      expiresInDays: 7,
    });

    expect(mail.subject).toContain('Ana Ruiz');
    expect(mail.subject).toContain('Acme');
    expect(mail.html).toContain('Acme');
    expect(mail.text).toContain('7 días');
  });

  it('sin nombre de quien invita usa una fórmula impersonal', () => {
    const mail = invitationEmail({
      appName: 'Silmari',
      url: 'https://app.silmari.test/invite/xyz',
      workspaceName: 'Acme',
      expiresInDays: 7,
    });
    expect(mail.subject).toContain('Te han invitado');
  });

  it('escapa el HTML de los datos interpolados', () => {
    const mail = invitationEmail({
      appName: 'Silmari',
      url: 'https://app.silmari.test/invite/xyz',
      workspaceName: '<script>alert(1)</script>',
      expiresInDays: 7,
    });

    expect(mail.html).not.toContain('<script>');
    expect(mail.html).toContain('&lt;script&gt;');
  });
});
