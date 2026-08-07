'use server';

import { redirect } from 'next/navigation';
import { revalidatePath } from 'next/cache';
import { getContext } from '@/lib/auth/dal';
import { destroySessionCookie } from '@/lib/auth/session';
import { toActionError } from '@/lib/errors/to-response';
import { parseOrThrow } from '@/lib/validation/zod-helpers';
import { changePasswordSchema } from '@/lib/validation/auth';
import { updateProfile, changePassword, deleteAccount } from '@/lib/accounts/profile';
import { updateWorkspace } from '@/lib/workspaces/service';
import { createObject, updateObject, deleteObject } from '@/lib/metadata/object-service';
import { createField, updateField, deleteField } from '@/lib/metadata/field-service';
import { createApiKey, listApiKeys, revokeApiKey } from '@/lib/auth/api-key';
import { createWebhook, listWebhooks, deleteWebhook, retryDelivery } from '@/lib/webhooks/service';

async function withCtx(fn) {
  const ctx = await getContext();
  if (!ctx) return { ok: false, message: 'Sesión no válida', code: 'UNAUTHORIZED' };
  try {
    return { ok: true, data: await fn(ctx) };
  } catch (err) {
    return toActionError(err);
  }
}

// --- Perfil y workspace ---
export async function updateProfileAction(input) {
  const res = await withCtx((ctx) => updateProfile(ctx, input));
  // Refresca el cromo (avatar y nombre del topbar) tras guardar.
  if (res.ok) revalidatePath('/', 'layout');
  return res;
}
export async function updateWorkspaceAction(input) {
  const res = await withCtx((ctx) => updateWorkspace(ctx, input));
  // Refresca el switcher, la home y demás server components con el nombre/logo.
  if (res.ok) revalidatePath('/', 'layout');
  return res;
}
export async function changePasswordAction(input) {
  return withCtx((ctx) => changePassword(ctx, parseOrThrow(changePasswordSchema, input)));
}

/**
 * Elimina (soft) la cuenta, cierra sesión y lleva a la puerta de entrada. El
 * redirect va fuera del try para no ser capturado como error de dominio.
 */
export async function deleteAccountAction() {
  const ctx = await getContext();
  if (!ctx) return { ok: false, message: 'Sesión no válida', code: 'UNAUTHORIZED' };
  try {
    await deleteAccount(ctx);
    await destroySessionCookie();
  } catch (err) {
    return toActionError(err);
  }
  redirect('/welcome');
}

// --- Modelo de datos ---
export async function createObjectAction(input) {
  return withCtx((ctx) => createObject(ctx, input));
}
export async function updateObjectAction({ id, patch }) {
  return withCtx((ctx) => updateObject(ctx, id, patch));
}
export async function deleteObjectAction({ id }) {
  return withCtx((ctx) => deleteObject(ctx, id));
}
export async function createFieldAction(input) {
  return withCtx((ctx) => createField(ctx, input));
}
export async function updateFieldAction({ id, patch }) {
  return withCtx((ctx) => updateField(ctx, id, patch));
}
export async function deleteFieldAction({ id }) {
  return withCtx((ctx) => deleteField(ctx, id));
}

// --- API keys ---
export async function createApiKeyAction(input) {
  return withCtx((ctx) => createApiKey(ctx, input));
}
export async function listApiKeysAction() {
  return withCtx((ctx) => listApiKeys(ctx));
}
export async function revokeApiKeyAction({ id }) {
  return withCtx((ctx) => revokeApiKey(ctx, id));
}

// --- Webhooks ---
export async function createWebhookAction(input) {
  return withCtx((ctx) => createWebhook(ctx, input));
}
export async function listWebhooksAction() {
  return withCtx((ctx) => listWebhooks(ctx));
}
export async function deleteWebhookAction({ id }) {
  return withCtx((ctx) => deleteWebhook(ctx, id));
}
export async function retryDeliveryAction(input) {
  return withCtx((ctx) => retryDelivery(ctx, input));
}
