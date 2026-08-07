import { describe, it, expect, beforeEach } from 'vitest';
import { consumeRateLimit, _resetRateLimit } from '@/lib/http/rate-limit';

describe('rate limit en memoria', () => {
  beforeEach(() => _resetRateLimit());

  it('permite hasta el límite y luego lanza 429', () => {
    const opts = { limit: 3, windowMs: 60_000, now: 1000 };
    expect(consumeRateLimit('k', opts).remaining).toBe(2);
    consumeRateLimit('k', opts);
    consumeRateLimit('k', opts);
    expect(() => consumeRateLimit('k', opts)).toThrow(/peticiones/i);
  });

  it('reinicia la ventana pasado el tiempo', () => {
    consumeRateLimit('k', { limit: 1, windowMs: 1000, now: 0 });
    expect(() => consumeRateLimit('k', { limit: 1, windowMs: 1000, now: 500 })).toThrow();
    expect(consumeRateLimit('k', { limit: 1, windowMs: 1000, now: 1500 }).remaining).toBe(0);
  });
});
