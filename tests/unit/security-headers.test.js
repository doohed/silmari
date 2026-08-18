import { describe, it, expect } from 'vitest';
import { buildCsp, STATIC_SECURITY_HEADERS } from '@/lib/http/security-headers';
import { validateUpload, contentDisposition, MAX_UPLOAD_BYTES } from '@/lib/attachments/limits';

describe('CSP', () => {
  it('firma los scripts con el nonce y no permite unsafe-inline en scripts', () => {
    const csp = buildCsp({ nonce: 'abc123' });
    const scriptSrc = csp.split('; ').find((d) => d.startsWith('script-src'));

    expect(scriptSrc).toContain("'nonce-abc123'");
    expect(scriptSrc).toContain("'strict-dynamic'");
    expect(scriptSrc).not.toContain("'unsafe-inline'");
    expect(scriptSrc).not.toContain("'unsafe-eval'");
  });

  it('en desarrollo permite unsafe-eval (lo necesita el refresco en caliente)', () => {
    const csp = buildCsp({ nonce: 'abc123', isDev: true });
    const scriptSrc = csp.split('; ').find((d) => d.startsWith('script-src'));
    expect(scriptSrc).toContain("'unsafe-eval'");
    // Y no fuerza HTTPS, que en local no existe.
    expect(csp).not.toContain('upgrade-insecure-requests');
  });

  it('bloquea el embebido y los objetos, y admite las imágenes en data URL', () => {
    const csp = buildCsp({ nonce: 'n' });
    expect(csp).toContain("frame-ancestors 'none'");
    expect(csp).toContain("object-src 'none'");
    expect(csp).toContain("base-uri 'self'");
    // Logos y avatares se guardan como data URL; las previsualizaciones son blob.
    expect(csp).toContain('img-src');
    expect(csp.split('; ').find((d) => d.startsWith('img-src'))).toContain('data:');
  });

  it('mantiene unsafe-inline en estilos, que hoy no se puede quitar', () => {
    const styleSrc = buildCsp({ nonce: 'n' })
      .split('; ')
      .find((d) => d.startsWith('style-src'));
    expect(styleSrc).toContain("'unsafe-inline'");
  });

  it('declara las cabeceras estáticas esperadas', () => {
    const keys = STATIC_SECURITY_HEADERS.map((h) => h.key);
    expect(keys).toContain('X-Content-Type-Options');
    expect(keys).toContain('Strict-Transport-Security');
    expect(keys).toContain('Referrer-Policy');
    expect(keys).toContain('Permissions-Policy');
  });
});

describe('límites de subida', () => {
  it('acepta un archivo normal', () => {
    expect(validateUpload({ size: 1024, mimeType: 'image/png' })).toEqual({ ok: true });
    // El charset del tipo no debe estorbar.
    expect(validateUpload({ size: 10, mimeType: 'text/plain; charset=utf-8' })).toEqual({
      ok: true,
    });
  });

  it('rechaza los que superan el tamaño máximo', () => {
    const r = validateUpload({ size: MAX_UPLOAD_BYTES + 1, mimeType: 'image/png' });
    expect(r.ok).toBe(false);
    expect(r.message).toMatch(/límite/i);
  });

  it('rechaza HTML y SVG, que se ejecutarían como documento', () => {
    expect(validateUpload({ size: 10, mimeType: 'text/html' }).ok).toBe(false);
    expect(validateUpload({ size: 10, mimeType: 'image/svg+xml' }).ok).toBe(false);
    expect(validateUpload({ size: 10, mimeType: '' }).ok).toBe(false);
  });

  it('rechaza un archivo vacío', () => {
    expect(validateUpload({ size: 0, mimeType: 'image/png' }).ok).toBe(false);
  });

  it('sirve en línea solo los tipos inofensivos', () => {
    expect(contentDisposition({ mimeType: 'image/png', name: 'a.png' })).toMatch(/^inline/);
    expect(contentDisposition({ mimeType: 'application/pdf', name: 'a.pdf' })).toMatch(/^inline/);
    expect(contentDisposition({ mimeType: 'application/zip', name: 'a.zip' })).toMatch(
      /^attachment/,
    );
  });

  it('codifica el nombre para que no se pueda inyectar en la cabecera', () => {
    const value = contentDisposition({ mimeType: 'image/png', name: 'foto "rara"\r\nX: y.png' });
    expect(value).not.toContain('\r');
    expect(value).not.toContain('\n');
    expect(value).not.toContain('"');
  });
});
