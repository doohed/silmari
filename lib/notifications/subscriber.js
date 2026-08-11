import { subscribe } from '@/lib/events/bus';
import { notifyUsers } from '@/lib/notifications/service';

/**
 * Suscriptor de notificaciones in-app. Traduce eventos de dominio a filas en la
 * bandeja de cada destinatario. Por ahora reacciona a `task.assigned`; irá
 * creciendo (menciones, vencimientos, cambios en registros seguidos) conforme
 * los emisores publiquen esos eventos.
 */
subscribe('notifications', async (ctx, event) => {
  if (event?.type !== 'task.assigned') return;
  const { taskId, title, recipientIds } = event.payload ?? {};
  await notifyUsers({
    workspaceId: ctx.workspaceId,
    userIds: recipientIds,
    actorId: ctx.userId,
    type: 'task.assigned',
    title: 'Te asignaron una tarea',
    body: title || 'Tarea sin título',
    entity: { kind: 'task', id: taskId },
    url: '/tasks',
  });
});
