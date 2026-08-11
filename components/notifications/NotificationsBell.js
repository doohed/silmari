'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Bell, CheckCheck } from 'lucide-react';
import { Avatar } from '@/components/ui/Avatar';
import { formatRelative } from '@/lib/utils/relative-time';
import {
  listNotificationsAction,
  unreadCountAction,
  markNotificationReadAction,
  markAllNotificationsReadAction,
} from '@/app/(workspace)/notifications/actions';

const POLL_MS = 45000;

/**
 * Campana de notificaciones del rail. Muestra el nº sin leer (sondeo periódico)
 * y, al abrir, la bandeja del usuario. Al hacer clic en una, la marca como leída
 * y navega a su recurso.
 */
export function NotificationsBell() {
  const ref = useRef(null);
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [unread, setUnread] = useState(0);
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(false);

  const refreshCount = useCallback(async () => {
    const res = await unreadCountAction();
    if (res.ok) setUnread(res.data ?? 0);
  }, []);

  // Sondeo del contador (y una vez al montar). refreshCount hace setState tras
  // un await, no de forma síncrona; la regla no lo distingue.
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    refreshCount();
    const timer = setInterval(refreshCount, POLL_MS);
    return () => clearInterval(timer);
  }, [refreshCount]);

  // Cerrar al clic fuera o con Escape.
  useEffect(() => {
    if (!open) return undefined;
    const onDoc = (e) => {
      if (ref.current && !ref.current.contains(e.target)) setOpen(false);
    };
    const onKey = (e) => e.key === 'Escape' && setOpen(false);
    document.addEventListener('mousedown', onDoc);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onDoc);
      document.removeEventListener('keydown', onKey);
    };
  }, [open]);

  async function toggle() {
    const next = !open;
    setOpen(next);
    if (next) {
      setLoading(true);
      const res = await listNotificationsAction();
      if (res.ok) setItems(res.data ?? []);
      setLoading(false);
    }
  }

  async function openItem(n) {
    setOpen(false);
    if (!n.readAt) {
      setItems((prev) => prev.map((it) => (it.id === n.id ? { ...it, readAt: new Date() } : it)));
      setUnread((c) => Math.max(0, c - 1));
      await markNotificationReadAction({ id: n.id });
    }
    if (n.url) router.push(n.url);
  }

  async function markAll() {
    setItems((prev) => prev.map((it) => ({ ...it, readAt: it.readAt ?? new Date() })));
    setUnread(0);
    await markAllNotificationsReadAction();
  }

  return (
    <div ref={ref} className="relative">
      <button
        type="button"
        onClick={toggle}
        aria-haspopup="menu"
        aria-expanded={open}
        aria-label="Notificaciones"
        className="hover:bg-chip-gray text-secondary hover:text-primary relative flex h-8 w-8 items-center justify-center rounded-md"
      >
        <Bell size={16} />
        {unread > 0 && (
          <span className="bg-accent text-accent-fg absolute -top-0.5 -right-0.5 flex h-4 min-w-4 items-center justify-center rounded-full px-1 text-[10px] font-semibold">
            {unread > 9 ? '9+' : unread}
          </span>
        )}
      </button>

      {open && (
        <div
          role="menu"
          className="anim-pop border-border bg-elevated absolute top-full left-0 z-40 mt-1 w-80 max-w-[calc(100vw-1rem)] rounded-lg border p-1 shadow-md"
        >
          <div className="flex items-center justify-between px-2 py-1.5">
            <p className="text-primary text-[13px] font-medium">Notificaciones</p>
            {items.some((n) => !n.readAt) && (
              <button
                type="button"
                onClick={markAll}
                className="text-tertiary hover:text-primary flex items-center gap-1 text-xs"
              >
                <CheckCheck size={13} /> Marcar todas leídas
              </button>
            )}
          </div>
          <div className="border-border my-1 border-t" />

          <div className="max-h-96 overflow-y-auto">
            {loading ? (
              <p className="text-tertiary px-2 py-6 text-center text-[13px]">Cargando…</p>
            ) : items.length === 0 ? (
              <p className="text-tertiary px-2 py-6 text-center text-[13px]">
                No tienes notificaciones
              </p>
            ) : (
              items.map((n) => (
                <button
                  key={n.id}
                  type="button"
                  role="menuitem"
                  onClick={() => openItem(n)}
                  className="hover:bg-chip-gray flex w-full items-start gap-2.5 rounded-md px-2 py-2 text-left"
                >
                  <span className="mt-0.5 shrink-0">
                    <Avatar name={n.actor?.label ?? ''} src={n.actor?.avatarUrl} size={22} />
                  </span>
                  <span className="min-w-0 flex-1">
                    <span className="text-primary block text-[13px] font-medium">{n.title}</span>
                    {n.body && (
                      <span className="text-secondary block truncate text-xs">{n.body}</span>
                    )}
                    <span className="text-tertiary block text-[11px]">
                      {formatRelative(n.createdAt)}
                    </span>
                  </span>
                  {!n.readAt && (
                    <span className="bg-accent mt-1.5 h-2 w-2 shrink-0 rounded-full" aria-hidden />
                  )}
                </button>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  );
}

export default NotificationsBell;
