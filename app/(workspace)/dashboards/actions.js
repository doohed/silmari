'use server';

import { getContext } from '@/lib/auth/dal';
import { toActionError } from '@/lib/errors/to-response';
import {
  createDashboard,
  renameDashboard,
  deleteDashboard,
  reorderDashboard,
  updateDashboardWidgets,
} from '@/lib/dashboards/service';

async function withCtx(fn) {
  const ctx = await getContext();
  if (!ctx) return { ok: false, message: 'Sesión no válida', code: 'UNAUTHORIZED' };
  try {
    return { ok: true, data: await fn(ctx) };
  } catch (err) {
    return toActionError(err);
  }
}

/** Crea un panel nuevo. */
export async function createDashboardAction(input) {
  return withCtx((ctx) => createDashboard(ctx, input));
}

/** Renombra un panel. */
export async function renameDashboardAction(input) {
  return withCtx((ctx) => renameDashboard(ctx, input));
}

/** Borra un panel (no permite borrar el último). */
export async function deleteDashboardAction(input) {
  return withCtx((ctx) => deleteDashboard(ctx, input));
}

/** Cambia el orden de un panel (arrastrar y soltar). */
export async function reorderDashboardAction(input) {
  return withCtx((ctx) => reorderDashboard(ctx, input));
}

/** Guarda el orden/composición de widgets de un panel. */
export async function updateDashboardWidgetsAction(input) {
  return withCtx((ctx) => updateDashboardWidgets(ctx, input));
}
