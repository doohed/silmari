import { describe, it, expect } from 'vitest';
import { isSafeRedirectUrl, normalizeRedirectUrl } from '@/lib/forms/redirect-url';

describe('isSafeRedirectUrl', () => {
  it('admite http y https absolutas', () => {
    expect(isSafeRedirectUrl('https://ejemplo.com/gracias')).toBe(true);
    expect(isSafeRedirectUrl('http://ejemplo.com')).toBe(true);
    expect(isSafeRedirectUrl('  https://ejemplo.com/a?b=c  ')).toBe(true);
  });

  it('rechaza los esquemas que ejecutan código en nuestro origen', () => {
    expect(isSafeRedirectUrl('javascript:alert(1)')).toBe(false);
    expect(isSafeRedirectUrl('JavaScript:alert(1)')).toBe(false);
    expect(isSafeRedirectUrl('data:text/html,<script>alert(1)</script>')).toBe(false);
    expect(isSafeRedirectUrl('vbscript:msgbox(1)')).toBe(false);
  });

  it('rechaza lo que no es una URL absoluta', () => {
    expect(isSafeRedirectUrl('/gracias')).toBe(false);
    expect(isSafeRedirectUrl('ejemplo.com')).toBe(false);
    expect(isSafeRedirectUrl('')).toBe(false);
    expect(isSafeRedirectUrl(null)).toBe(false);
    expect(isSafeRedirectUrl(undefined)).toBe(false);
  });
});

describe('normalizeRedirectUrl', () => {
  it('deja null cuando el campo viene vacío', () => {
    expect(normalizeRedirectUrl('')).toBeNull();
    expect(normalizeRedirectUrl('   ')).toBeNull();
    expect(normalizeRedirectUrl(undefined)).toBeNull();
  });

  it('recorta los espacios', () => {
    expect(normalizeRedirectUrl('  https://ejemplo.com  ')).toBe('https://ejemplo.com');
  });
});
