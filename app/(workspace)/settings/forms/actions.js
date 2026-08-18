'use server';

import { getContext } from '@/lib/auth/dal';
import { toActionError } from '@/lib/errors/to-response';
import { createForm, listForms, updateForm, toggleForm, deleteForm } from '@/lib/forms/service';

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

export async function listFormsAction() {
  return withCtx((ctx) => listForms(ctx));
}

export async function createFormAction(input) {
  return withCtx((ctx) => createForm(ctx, input ?? {}));
}

export async function updateFormAction({ id, patch }) {
  return withCtx((ctx) => updateForm(ctx, id, patch ?? {}));
}

export async function toggleFormAction({ id }) {
  return withCtx((ctx) => toggleForm(ctx, id));
}

export async function deleteFormAction({ id }) {
  return withCtx((ctx) => deleteForm(ctx, id));
}
