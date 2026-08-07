import { connectToDatabase } from '@/lib/db/connect';
import { assertTenant } from '@/lib/services/tenant';
import TimelineActivity from '@/models/TimelineActivity';

/**
 * Diff campo a campo entre dos objetos `data`. Solo incluye claves que cambian.
 * @param {Record<string, any>} before
 * @param {Record<string, any>} after
 * @returns {Record<string, { before: any, after: any }>}
 */
export function diffData(before = {}, after = {}) {
  const diff = {};
  const keys = new Set([...Object.keys(before), ...Object.keys(after)]);
  for (const key of keys) {
    const a = before[key];
    const b = after[key];
    if (JSON.stringify(a) !== JSON.stringify(b))
      diff[key] = { before: a ?? null, after: b ?? null };
  }
  return diff;
}

/**
 * Registra un evento en el timeline (log inmutable).
 * @param {import('@/lib/auth/permissions').Ctx} ctx
 * @param {{ recordId: any, objectMetadataId: any, event: string, diff?: object, actor?: object }} entry
 * @param {{ session?: import('mongoose').ClientSession }} [opts]
 */
export async function logEvent(ctx, entry, { session } = {}) {
  await connectToDatabase();
  await TimelineActivity.create(
    [
      {
        workspaceId: ctx.workspaceId,
        recordId: entry.recordId,
        objectMetadataId: entry.objectMetadataId,
        event: entry.event,
        diff: entry.diff ?? {},
        actor: entry.actor ?? { userId: ctx.userId, name: '', source: 'MANUAL' },
      },
    ],
    { session },
  );
}

/**
 * Lista el timeline de un registro (más reciente primero).
 * @param {import('@/lib/auth/permissions').Ctx} ctx
 * @param {any} recordId
 * @param {{ limit?: number }} [opts]
 */
export async function listTimeline(ctx, recordId, { limit = 50 } = {}) {
  assertTenant(ctx);
  await connectToDatabase();
  const items = await TimelineActivity.find({ workspaceId: ctx.workspaceId, recordId })
    .sort({ createdAt: -1 })
    .limit(limit)
    .lean();
  return items.map((i) => ({
    id: String(i._id),
    event: i.event,
    diff: i.diff ?? {},
    actor: i.actor ?? null,
    createdAt: i.createdAt,
  }));
}
