import { describe, it, expect } from 'vitest';
import { LEGAL, legalIsDraft, COOKIES, SUBPROCESSORS } from '@/lib/config/legal';

describe('configuración legal', () => {
  it('detecta que los textos siguen siendo un borrador', () => {
    // Mientras queden marcadores, las páginas muestran el aviso de borrador.
    // Cuando rellenes `lib/config/legal.js`, este test pasará a `false` y habrá
    // que actualizarlo: es el recordatorio de que ya se puede publicar.
    expect(legalIsDraft()).toBe(true);
  });

  it('no da por bueno un dato a medias', () => {
    expect(Object.keys(LEGAL)).toContain('companyName');
    expect(Object.keys(LEGAL)).toContain('privacyEmail');
  });

  it('documenta exactamente las cookies que pone la app', () => {
    const names = COOKIES.map((c) => c.name);
    expect(names).toContain('silmari_session');
    expect(names).toContain('theme');
    expect(names).toContain('locale');
  });

  it('ninguna cookie declarada es de analítica o publicidad', () => {
    // Si algún día se añade una, este test falla y obliga a replantear el
    // consentimiento previo antes de publicarla.
    for (const cookie of COOKIES) {
      expect(['Estrictamente necesaria', 'Preferencia del usuario']).toContain(cookie.category);
    }
  });

  it('lista los encargados del tratamiento con su finalidad', () => {
    expect(SUBPROCESSORS.length).toBeGreaterThan(0);
    for (const s of SUBPROCESSORS) {
      expect(s.name).toBeTruthy();
      expect(s.purpose).toBeTruthy();
      expect(s.location).toBeTruthy();
    }
    expect(SUBPROCESSORS.map((s) => s.name)).toContain('Stripe');
    expect(SUBPROCESSORS.map((s) => s.name)).toContain('Resend');
  });
});
