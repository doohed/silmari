'use server';

import { getContext } from '@/lib/auth/dal';
import { toActionError } from '@/lib/errors/to-response';
import {
  createTemplate,
  listTemplates,
  updateTemplate,
  deleteTemplate,
} from '@/lib/templates/service';

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

export async function listTemplatesAction() {
  return withCtx((ctx) => listTemplates(ctx));
}

export async function createTemplateAction(input) {
  return withCtx((ctx) => createTemplate(ctx, input ?? {}));
}

export async function updateTemplateAction({ id, patch }) {
  return withCtx((ctx) => updateTemplate(ctx, id, patch ?? {}));
}

export async function deleteTemplateAction({ id }) {
  return withCtx((ctx) => deleteTemplate(ctx, id));
}
