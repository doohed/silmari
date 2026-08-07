import { describe, it, expect } from 'vitest';
import { can } from '@/lib/auth/permissions';

const base = { userId: 'u1', workspaceId: 'w1' };
const owner = { ...base, role: 'OWNER' };
const admin = { ...base, role: 'ADMIN' };
const member = { ...base, role: 'MEMBER' };

describe('can(ctx, action)', () => {
  it('OWNER puede todo lo definido', () => {
    expect(can(owner, 'members:read')).toBe(true);
    expect(can(owner, 'members:invite')).toBe(true);
    expect(can(owner, 'members:changeRole')).toBe(true);
    expect(can(owner, 'workspace:delete')).toBe(true);
  });

  it('ADMIN invita pero no cambia roles ni borra el workspace', () => {
    expect(can(admin, 'members:read')).toBe(true);
    expect(can(admin, 'members:invite')).toBe(true);
    expect(can(admin, 'members:remove')).toBe(true);
    expect(can(admin, 'members:changeRole')).toBe(false);
    expect(can(admin, 'workspace:delete')).toBe(false);
  });

  it('MEMBER solo lee', () => {
    expect(can(member, 'members:read')).toBe(true);
    expect(can(member, 'members:invite')).toBe(false);
    expect(can(member, 'workspace:update')).toBe(false);
  });

  it('deniega sin contexto o con acción desconocida', () => {
    expect(can(null, 'members:read')).toBe(false);
    expect(can(undefined, 'members:read')).toBe(false);
    expect(can(owner, 'accion:inexistente')).toBe(false);
  });
});
