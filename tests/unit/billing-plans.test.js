import { describe, it, expect, afterEach } from 'vitest';
import {
  PLANS,
  resolvePlan,
  isWithinLimit,
  planFromPriceId,
  priceIdForPlan,
} from '@/lib/billing/plans';

describe('resolvePlan', () => {
  it('sin suscripción, plan gratis', () => {
    expect(resolvePlan(null).key).toBe('FREE');
    expect(resolvePlan(undefined).key).toBe('FREE');
  });

  it('devuelve el plan contratado si la suscripción está viva', () => {
    expect(resolvePlan({ plan: 'PRO', status: 'active' }).key).toBe('PRO');
    expect(resolvePlan({ plan: 'PRO', status: 'trialing' }).key).toBe('PRO');
  });

  it('mantiene el plan en past_due: un cobro fallido no corta el servicio de golpe', () => {
    expect(resolvePlan({ plan: 'BUSINESS', status: 'past_due' }).key).toBe('BUSINESS');
  });

  it('degrada a gratis si la suscripción está cancelada o impagada', () => {
    expect(resolvePlan({ plan: 'PRO', status: 'canceled' }).key).toBe('FREE');
    expect(resolvePlan({ plan: 'PRO', status: 'unpaid' }).key).toBe('FREE');
    expect(resolvePlan({ plan: 'PRO', status: 'incomplete_expired' }).key).toBe('FREE');
  });

  it('degrada a gratis ante un plan desconocido en BD', () => {
    expect(resolvePlan({ plan: 'INVENTADO', status: 'active' }).key).toBe('FREE');
  });
});

describe('isWithinLimit', () => {
  it('deja crear mientras no se alcanza el tope', () => {
    expect(isWithinLimit(PLANS.FREE, 'members', 0)).toBe(true);
    expect(isWithinLimit(PLANS.FREE, 'members', 1)).toBe(true);
  });

  it('bloquea al alcanzarlo, no al superarlo', () => {
    // FREE permite 2 miembros: con 2 ya no cabe uno más.
    expect(isWithinLimit(PLANS.FREE, 'members', 2)).toBe(false);
    expect(isWithinLimit(PLANS.FREE, 'members', 3)).toBe(false);
  });

  it('null significa sin tope', () => {
    expect(isWithinLimit(PLANS.BUSINESS, 'records', 10_000_000)).toBe(true);
  });
});

describe('mapeo de precios de Stripe', () => {
  const original = { ...process.env };
  afterEach(() => {
    process.env.STRIPE_PRICE_PRO = original.STRIPE_PRICE_PRO;
    process.env.STRIPE_PRICE_BUSINESS = original.STRIPE_PRICE_BUSINESS;
  });

  it('traduce el price al plan y a la inversa', () => {
    process.env.STRIPE_PRICE_PRO = 'price_pro_123';
    process.env.STRIPE_PRICE_BUSINESS = 'price_biz_456';

    expect(planFromPriceId('price_pro_123')).toBe('PRO');
    expect(planFromPriceId('price_biz_456')).toBe('BUSINESS');
    expect(priceIdForPlan('PRO')).toBe('price_pro_123');
  });

  it('un price desconocido no resuelve a ningún plan', () => {
    process.env.STRIPE_PRICE_PRO = 'price_pro_123';
    expect(planFromPriceId('price_de_otro_producto')).toBeNull();
    expect(planFromPriceId('')).toBeNull();
    expect(planFromPriceId(undefined)).toBeNull();
  });

  it('el plan gratis no tiene price', () => {
    expect(priceIdForPlan('FREE')).toBeNull();
  });
});
