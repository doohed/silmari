import { describe, it, expect } from 'vitest';
import mongoose from 'mongoose';
import { createAccount } from '@/lib/accounts/signup';
import {
  notifyUsers,
  listNotifications,
  unreadCount,
  markRead,
  markAllRead,
} from '@/lib/notifications/service';

let seq = 0;

async function owner() {
  seq += 1;
  const { userId, workspaceId } = await createAccount({
    firstName: 'Note',
    lastName: 'Recip',
    email: `notif${seq}@test.dev`,
    password: 'secret123',
    workspaceName: `Notif Co ${seq}`,
  });
  return { userId, workspaceId, role: 'OWNER' };
}

describe('notificaciones', () => {
  it('crea una notificación para el destinatario y la lista con conteo sin leer', async () => {
    const ctx = await owner();
    const actorId = new mongoose.Types.ObjectId().toString();

    const created = await notifyUsers({
      workspaceId: ctx.workspaceId,
      userIds: [ctx.userId],
      actorId,
      type: 'task.assigned',
      title: 'Te asignaron una tarea',
      body: 'Llamar al cliente',
      entity: { kind: 'task', id: 't1' },
      url: '/tasks',
    });
    expect(created).toBe(1);

    const items = await listNotifications(ctx, {});
    expect(items).toHaveLength(1);
    expect(items[0].title).toBe('Te asignaron una tarea');
    expect(items[0].body).toBe('Llamar al cliente');
    expect(items[0].readAt).toBeNull();
    expect(await unreadCount(ctx)).toBe(1);
  });

  it('nunca notifica al propio actor', async () => {
    const ctx = await owner();
    const created = await notifyUsers({
      workspaceId: ctx.workspaceId,
      userIds: [ctx.userId],
      actorId: ctx.userId,
      type: 'task.assigned',
      title: 'Te asignaron una tarea',
    });
    expect(created).toBe(0);
    expect(await unreadCount(ctx)).toBe(0);
  });

  it('descarta destinatarios de tipo API key', async () => {
    const ctx = await owner();
    const created = await notifyUsers({
      workspaceId: ctx.workspaceId,
      userIds: ['apikey:abc', ctx.userId],
      actorId: new mongoose.Types.ObjectId().toString(),
      type: 'task.assigned',
      title: 'Te asignaron una tarea',
    });
    expect(created).toBe(1);
  });

  it('marcar una / todas como leídas baja el conteo', async () => {
    const ctx = await owner();
    const actorId = new mongoose.Types.ObjectId().toString();
    for (const body of ['a', 'b', 'c']) {
      await notifyUsers({
        workspaceId: ctx.workspaceId,
        userIds: [ctx.userId],
        actorId,
        type: 'task.assigned',
        title: 'x',
        body,
      });
    }
    expect(await unreadCount(ctx)).toBe(3);

    const items = await listNotifications(ctx, {});
    await markRead(ctx, items[0].id);
    expect(await unreadCount(ctx)).toBe(2);

    await markAllRead(ctx);
    expect(await unreadCount(ctx)).toBe(0);
  });

  it('no filtra notificaciones de otro workspace', async () => {
    const a = await owner();
    const b = await owner();
    await notifyUsers({
      workspaceId: a.workspaceId,
      userIds: [a.userId],
      actorId: new mongoose.Types.ObjectId().toString(),
      type: 'task.assigned',
      title: 'solo A',
    });
    expect(await unreadCount(b)).toBe(0);
    expect(await listNotifications(b, {})).toHaveLength(0);
  });
});
