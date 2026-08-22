import { describe, it, expect } from 'vitest';
import mongoose from 'mongoose';
import { createAccount } from '@/lib/accounts/signup';
import { createActivity, updateActivity } from '@/lib/activities/service';
import { subscribe } from '@/lib/events/bus';
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

  it('por defecto no notifica al propio actor', async () => {
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

  it('con excludeActor:false sí notifica al propio actor', async () => {
    const ctx = await owner();
    const created = await notifyUsers({
      workspaceId: ctx.workspaceId,
      userIds: [ctx.userId],
      actorId: ctx.userId,
      excludeActor: false,
      type: 'automation',
      title: 'Nueva empresa',
    });
    expect(created).toBe(1);
    expect(await unreadCount(ctx)).toBe(1);
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

/**
 * Cableado de la emisión: `createActivity`/`updateActivity` deben publicar el
 * evento `task.assigned` con los destinatarios correctos. Se comprueba con un
 * espía síncrono en el bus (determinista); el efecto downstream (crear la fila
 * de notificación) ya lo cubren los tests de `notifyUsers` de arriba.
 */
describe('actividades → evento task.assigned', () => {
  /** Recolecta los eventos del bus mientras corre `fn`, y limpia el espía. */
  async function captureEvents(fn) {
    const events = [];
    subscribe('__spy__', (_ctx, e) => events.push(e));
    try {
      await fn();
      await Promise.resolve();
      await Promise.resolve();
    } finally {
      // El registro es un Map por nombre; sobrescribir con un no-op lo desactiva.
      subscribe('__spy__', () => {});
    }
    return events;
  }

  it('crear una tarea asignada a otra persona emite task.assigned', async () => {
    const ctx = await owner();
    const other = new mongoose.Types.ObjectId().toString();
    const events = await captureEvents(() =>
      createActivity(ctx, { type: 'TASK', title: 'Revisar', assigneeIds: [other] }),
    );
    const ev = events.find((e) => e.type === 'task.assigned');
    expect(ev).toBeTruthy();
    expect(ev.payload.recipientIds).toContain(other);
    expect(ev.payload.title).toBe('Revisar');
  });

  it('reasignar una tarea solo anuncia a los responsables nuevos', async () => {
    const ctx = await owner();
    const first = new mongoose.Types.ObjectId().toString();
    const second = new mongoose.Types.ObjectId().toString();
    const task = await createActivity(ctx, { type: 'TASK', title: 'x', assigneeIds: [first] });

    const events = await captureEvents(() =>
      updateActivity(ctx, task.id, { assigneeIds: [first, second] }),
    );
    const ev = events.find((e) => e.type === 'task.assigned');
    expect(ev).toBeTruthy();
    expect(ev.payload.recipientIds).toEqual([second]); // `first` ya lo era
  });

  it('actualizar una tarea sin tocar responsables no emite el evento', async () => {
    const ctx = await owner();
    const task = await createActivity(ctx, { type: 'TASK', title: 'y' });
    const events = await captureEvents(
      () => updateActivity(ctx, task.id, { title: 'y2' }), // no toca assigneeIds
    );
    expect(events.find((e) => e.type === 'task.assigned')).toBeUndefined();
  });
});
