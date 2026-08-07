'use server';

import { getContext } from '@/lib/auth/dal';
import { toActionError } from '@/lib/errors/to-response';
import {
  listUserNotes,
  createUserNote,
  updateUserNote,
  deleteUserNote,
} from '@/lib/user-notes/service';

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

export async function listNotesAction() {
  return withCtx((ctx) => listUserNotes(ctx));
}

export async function createNoteAction(input) {
  return withCtx((ctx) => createUserNote(ctx, input ?? {}));
}

export async function updateNoteAction({ id, patch }) {
  return withCtx((ctx) => updateUserNote(ctx, id, patch));
}

export async function deleteNoteAction({ id }) {
  return withCtx((ctx) => deleteUserNote(ctx, id));
}
