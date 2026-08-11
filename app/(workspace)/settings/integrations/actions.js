'use server';

import { getContext } from '@/lib/auth/dal';
import { toActionError } from '@/lib/errors/to-response';
import {
  saveEmailConnection,
  deleteEmailConnection,
  saveWhatsappConnection,
  deleteWhatsappConnection,
} from '@/lib/integrations/service';

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

export async function saveEmailConnectionAction(input) {
  return withCtx((ctx) => saveEmailConnection(ctx, input ?? {}));
}
export async function deleteEmailConnectionAction() {
  return withCtx((ctx) => deleteEmailConnection(ctx));
}
export async function saveWhatsappConnectionAction(input) {
  return withCtx((ctx) => saveWhatsappConnection(ctx, input ?? {}));
}
export async function deleteWhatsappConnectionAction() {
  return withCtx((ctx) => deleteWhatsappConnection(ctx));
}
