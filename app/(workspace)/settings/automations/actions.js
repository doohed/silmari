'use server';

import { getContext } from '@/lib/auth/dal';
import { toActionError } from '@/lib/errors/to-response';
import {
  createAutomation,
  listAutomations,
  updateAutomation,
  toggleAutomation,
  deleteAutomation,
} from '@/lib/automations/service';

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

export async function listAutomationsAction() {
  return withCtx((ctx) => listAutomations(ctx));
}

export async function createAutomationAction(input) {
  return withCtx((ctx) => createAutomation(ctx, input ?? {}));
}

export async function updateAutomationAction({ id, patch }) {
  return withCtx((ctx) => updateAutomation(ctx, id, patch ?? {}));
}

export async function toggleAutomationAction({ id }) {
  return withCtx((ctx) => toggleAutomation(ctx, id));
}

export async function deleteAutomationAction({ id }) {
  return withCtx((ctx) => deleteAutomation(ctx, id));
}
