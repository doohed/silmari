'use server';

import { redirect } from 'next/navigation';
import { revalidatePath } from 'next/cache';
import { getContext } from '@/lib/auth/dal';
import { createSessionCookie, destroySessionCookie } from '@/lib/auth/session';
import { toActionError } from '@/lib/errors/to-response';
import { parseOrThrow } from '@/lib/validation/zod-helpers';
import { changePasswordSchema } from '@/lib/validation/auth';
import { updateProfile, changePassword, deleteAccount } from '@/lib/accounts/profile';
import { updateWorkspace } from '@/lib/workspaces/service';
import { createObject, updateObject, deleteObject } from '@/lib/metadata/object-service';
import { createField, updateField, deleteField } from '@/lib/metadata/field-service';
import { listRollupSources } from '@/lib/relations/service';
import { listPriceFields } from '@/lib/quotes/service';
import { createApiKey, listApiKeys, revokeApiKey } from '@/lib/auth/api-key';
import { createWebhook, listWebhooks, deleteWebhook, retryDelivery } from '@/lib/webhooks/service';
import { getSubscription, createCheckoutSession, createPortalSession } from '@/lib/billing/service';
import { currentUsage } from '@/lib/billing/limits';
import {
  createLeadIntake,
  listLeadIntakes,
  updateLeadIntake,
  deleteLeadIntake,
} from '@/lib/leads/service';

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

/**
 * Cambia la contraseña. `changePassword` corta todas las sesiones abiertas
 * (`User.sessionsValidFrom`), así que hay que **re-emitir la cookie** de esta
 * misma sesión: si no, el usuario se quedaría fuera de la app justo después de
 * cambiar su contraseña desde Ajustes.
 */
export async function changePasswordAction(input) {
  /** @type {{ userId: string, workspaceId: string } | null} */
  let session = null;
  const res = await withCtx(async (ctx) => {
    const out = await changePassword(ctx, parseOrThrow(changePasswordSchema, input));
    // Se guarda aquí dentro, no releyendo el contexto después: tras el cambio,
    // la cookie que trae la petición ya no es válida.
    session = { userId: ctx.userId, workspaceId: ctx.workspaceId };
    return out;
  });
  if (res.ok && session) await createSessionCookie(session);
  return res;
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
// Crear/renombrar/borrar un objeto cambia la navegación (sidebar), que la pinta
// el layout (server). Revalidamos el layout para que se refleje sin recargar.
export async function createObjectAction(input) {
  const res = await withCtx((ctx) => createObject(ctx, input));
  if (res.ok) revalidatePath('/', 'layout');
  return res;
}
export async function updateObjectAction({ id, patch }) {
  const res = await withCtx((ctx) => updateObject(ctx, id, patch));
  if (res.ok) revalidatePath('/', 'layout');
  return res;
}
export async function deleteObjectAction({ id }) {
  const res = await withCtx((ctx) => deleteObject(ctx, id));
  if (res.ok) revalidatePath('/', 'layout');
  return res;
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
export async function rollupSourcesAction({ objectMetadataId }) {
  return withCtx((ctx) => listRollupSources(ctx, { objectMetadataId }));
}
export async function priceFieldsAction({ objectMetadataId }) {
  return withCtx((ctx) => listPriceFields(ctx, { objectMetadataId }));
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

// --- Entrada de leads (Meta Lead Ads vía Zapier/Make) ---
export async function listLeadIntakesAction() {
  return withCtx((ctx) => listLeadIntakes(ctx));
}
export async function createLeadIntakeAction(input) {
  return withCtx((ctx) => createLeadIntake(ctx, input));
}
export async function updateLeadIntakeAction({ id, ...input }) {
  return withCtx((ctx) => updateLeadIntake(ctx, id, input));
}
export async function deleteLeadIntakeAction({ id }) {
  return withCtx((ctx) => deleteLeadIntake(ctx, id));
}

// --- Facturación (Stripe) ---
export async function getSubscriptionAction() {
  return withCtx((ctx) => getSubscription(ctx));
}
export async function getUsageAction() {
  return withCtx((ctx) => currentUsage(ctx));
}
/** Devuelve la URL del Checkout; la redirección la hace el cliente. */
export async function createCheckoutAction({ plan }) {
  return withCtx((ctx) => createCheckoutSession(ctx, { plan }));
}
/** Devuelve la URL del portal de cliente de Stripe. */
export async function createPortalAction() {
  return withCtx((ctx) => createPortalSession(ctx));
}
