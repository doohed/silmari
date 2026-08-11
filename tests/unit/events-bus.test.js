import { describe, it, expect, beforeEach, vi } from 'vitest';
import {
  subscribe,
  emitDomainEvent,
  _resetSubscribers,
  _subscriberNames,
} from '@/lib/events/bus';
import { recordEvent } from '@/lib/events/types';

const ctx = { workspaceId: 'ws1', userId: 'u1', role: 'OWNER' };

describe('bus de eventos', () => {
  beforeEach(() => {
    _resetSubscribers();
  });

  it('entrega el evento a cada suscriptor registrado', async () => {
    const a = vi.fn();
    const b = vi.fn();
    subscribe('a', a);
    subscribe('b', b);

    const event = { type: 'record.created', payload: { id: '1' } };
    emitDomainEvent(ctx, event);
    await Promise.resolve();
    await Promise.resolve();

    expect(a).toHaveBeenCalledWith(ctx, event);
    expect(b).toHaveBeenCalledWith(ctx, event);
  });

  it('registrar con el mismo nombre reemplaza, no duplica', () => {
    subscribe('x', vi.fn());
    subscribe('x', vi.fn());
    expect(_subscriberNames()).toEqual(['x']);
  });

  it('un suscriptor que revienta no afecta a los demás ni propaga', async () => {
    const boom = vi.fn(() => {
      throw new Error('fallo');
    });
    const ok = vi.fn();
    subscribe('boom', boom);
    subscribe('ok', ok);

    expect(() => emitDomainEvent(ctx, { type: 'record.created' })).not.toThrow();
    await Promise.resolve();
    await Promise.resolve();

    expect(ok).toHaveBeenCalledOnce();
  });
});

describe('recordEvent', () => {
  const object = { id: 'obj1', slug: 'companies', nameSingular: 'company' };

  it('construye la operación de webhook y el tipo canónico', () => {
    const ev = recordEvent('created', object, { id: 'r1' });
    expect(ev.type).toBe('record.created');
    expect(ev.operation).toBe('company.created');
    expect(ev.object).toEqual({ id: 'obj1', slug: 'companies', nameSingular: 'company' });
    expect(ev.payload).toEqual({ id: 'r1' });
    expect(ev.meta).toBeUndefined();
  });

  it('adjunta meta cuando se pasa (p. ej. diff en updated)', () => {
    const ev = recordEvent('updated', object, { id: 'r1' }, { diff: { name: ['a', 'b'] } });
    expect(ev.operation).toBe('company.updated');
    expect(ev.meta).toEqual({ diff: { name: ['a', 'b'] } });
  });
});
