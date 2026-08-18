'use server';

import { getContext } from '@/lib/auth/dal';
import { toActionError } from '@/lib/errors/to-response';
import { listNotifications, unreadCount, markRead, markAllRead } from '@/lib/notifications/service';

/** Ejecuta `fn(ctx)` y devuelve `{ ok, data } | { ok:false, ... }`. */
async function withCtx(fn) {
  const ctx = await getContext();
  if (!ctx) return { ok: false, message: 'Sesión no válida', code: 'UNAUTHORIZED' };
  try {
    return { ok: true, data: await fn(ctx) };
  } catch (err) {
    return toActionError(err);
  }
}

export async function listNotificationsAction() {
  return withCtx((ctx) => listNotifications(ctx, {}));
}

export async function unreadCountAction() {
  return withCtx((ctx) => unreadCount(ctx));
}

export async function markNotificationReadAction({ id }) {
  return withCtx((ctx) => markRead(ctx, id));
}

export async function markAllNotificationsReadAction() {
  return withCtx((ctx) => markAllRead(ctx));
}
