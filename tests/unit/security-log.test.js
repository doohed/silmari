import { describe, it, expect, vi, afterEach } from 'vitest';
import { maskEmail, logSecurityEvent } from '@/lib/utils/logger';

describe('maskEmail', () => {
  it('deja lo justo para reconocer la cuenta y agrupar por dominio', () => {
    expect(maskEmail('ana.ruiz@gmail.com')).toBe('an***@gmail.com');
    expect(maskEmail('a@x.com')).toBe('a***@x.com');
  });

  it('no deja pasar lo que no sabe enmascarar', () => {
    expect(maskEmail('sin-arroba')).toBe('***');
    expect(maskEmail('@solodominio.com')).toBe('***');
    expect(maskEmail('')).toBe('');
    expect(maskEmail(null)).toBe('');
  });
});

describe('logSecurityEvent', () => {
  afterEach(() => vi.restoreAllMocks());

  it('escribe con el prefijo grepeable y enmascara el email', () => {
    const spy = vi.spyOn(console, 'log').mockImplementation(() => {});
    logSecurityEvent('login.failed', { email: 'ana@test.dev', ip: '1.2.3.4' });

    const linea = spy.mock.calls[0].join(' ');
    expect(linea).toContain('[sec]');
    expect(linea).toContain('login.failed');
    expect(linea).toContain('an***@test.dev');
    expect(linea).not.toContain('ana@test.dev');
  });
});
