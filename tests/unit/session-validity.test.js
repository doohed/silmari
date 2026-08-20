import { describe, it, expect } from 'vitest';
import { isSessionCurrent } from '@/lib/auth/jwt';

const at = (isoSeconds) => Math.floor(new Date(isoSeconds).getTime() / 1000);

describe('isSessionCurrent', () => {
  it('sin corte, cualquier sesión vale', () => {
    expect(isSessionCurrent({ iat: at('2026-01-01T00:00:00Z') }, null)).toBe(true);
    expect(isSessionCurrent({ iat: at('2026-01-01T00:00:00Z') }, undefined)).toBe(true);
  });

  it('una sesión anterior al corte deja de valer', () => {
    const session = { iat: at('2026-01-01T10:00:00Z') };
    expect(isSessionCurrent(session, new Date('2026-01-01T12:00:00Z'))).toBe(false);
  });

  it('una sesión posterior al corte sigue valiendo', () => {
    const session = { iat: at('2026-01-01T12:00:01Z') };
    expect(isSessionCurrent(session, new Date('2026-01-01T12:00:00Z'))).toBe(true);
  });

  it('el corte y la emisión en el mismo segundo no echan al usuario', () => {
    // Es el caso de quien cambia su contraseña desde Ajustes: el servicio pone
    // el corte y la acción re-emite la cookie acto seguido. El `iat` va en
    // segundos, así que ambos caen en el mismo y la comparación debe ser >=.
    const corte = new Date('2026-01-01T12:00:00.730Z');
    expect(isSessionCurrent({ iat: at('2026-01-01T12:00:00Z') }, corte)).toBe(true);
  });

  it('sin sesión, o sin iat, no vale', () => {
    expect(isSessionCurrent(null, null)).toBe(false);
    expect(isSessionCurrent({ userId: 'u' }, new Date())).toBe(false);
  });
});
