import mongoose from 'mongoose';
import { connectToDatabase } from '@/lib/db/connect';
import { getPlan } from '@/lib/billing/service';
import { isWithinLimit, RESOURCE_LABELS } from '@/lib/billing/plans';
import { ForbiddenError } from '@/lib/errors/domain-errors';
import ApiKey from '@/models/ApiKey';
import LeadIntake from '@/models/LeadIntake';
import Record from '@/models/Record';
import Webhook from '@/models/Webhook';
import Attachment from '@/models/Attachment';
import WorkspaceMember from '@/models/WorkspaceMember';

/**
 * Aplicación de los límites del plan.
 *
 * Va en la **capa de servicios**, nunca solo en la UI: la API pública y las
 * server actions comparten estos servicios, así que esconder un botón no
 * protege nada.
 *
 * Se cuenta en el momento de crear. Es una consulta más por alta, aceptable
 * porque son operaciones puntuales; si algún día pesa, se cachea el contador en
 * el documento del workspace.
 */

/** Cómo se cuenta cada recurso. */
const COUNTERS = {
  members: (workspaceId) => WorkspaceMember.countDocuments({ workspaceId }),
  records: (workspaceId) => Record.countDocuments({ workspaceId, deletedAt: null }),
  apiKeys: (workspaceId) => ApiKey.countDocuments({ workspaceId, revokedAt: null }),
  webhooks: (workspaceId) => Webhook.countDocuments({ workspaceId }),
  leadIntakes: (workspaceId) => LeadIntake.countDocuments({ workspaceId }),
};

/**
 * Cuenta lo que hay hoy de cada recurso. Lo usa la página de facturación para
 * enseñar "3 de 10 miembros".
 * @param {import('@/lib/auth/permissions').Ctx} ctx
 * @returns {Promise<Record<string, number>>}
 */
export async function currentUsage(ctx) {
  await connectToDatabase();
  const entries = await Promise.all(
    Object.entries(COUNTERS).map(async ([resource, count]) => [
      resource,
      await count(ctx.workspaceId),
    ]),
  );
  return Object.fromEntries(entries);
}

/**
 * Lanza si crear una unidad más de `resource` supera el plan.
 *
 * @param {import('@/lib/auth/permissions').Ctx} ctx
 * @param {keyof typeof COUNTERS} resource
 */
export async function assertWithinPlan(ctx, resource) {
  const counter = COUNTERS[resource];
  if (!counter) throw new Error(`Recurso sin contador: ${resource}`);

  const plan = await getPlan(ctx);
  // Sin tope no hace falta contar: nos ahorramos la consulta en el plan alto,
  // que es justo donde más registros hay.
  if (plan.limits[resource] === null || plan.limits[resource] === undefined) return;

  await connectToDatabase();
  const current = await counter(ctx.workspaceId);
  if (!isWithinLimit(plan, resource, current)) {
    throw new ForbiddenError(
      `Has alcanzado el límite de ${plan.limits[resource]} ${RESOURCE_LABELS[resource]} ` +
        `del plan ${plan.label}. Mejora el plan para añadir más.`,
      { code: 'PLAN_LIMIT' },
    );
  }
}

/**
 * Bytes de adjuntos vivos de un workspace.
 * @param {string} workspaceId
 * @returns {Promise<number>}
 */
export async function currentStorageBytes(workspaceId) {
  await connectToDatabase();
  const [row] = await Attachment.aggregate([
    { $match: { workspaceId: new mongoose.Types.ObjectId(String(workspaceId)), deletedAt: null } },
    { $group: { _id: null, total: { $sum: '$size' } } },
  ]);
  return row?.total ?? 0;
}

/**
 * Lanza si subir `incomingBytes` más pasaría del espacio del plan.
 *
 * Va aparte de `assertWithinPlan` porque el almacenamiento no se cuenta en
 * unidades sino en bytes: sumarlo al mecanismo de contadores obligaría a
 * retorcerlo y a escribir "has alcanzado el límite de 104857600 almacenamiento".
 *
 * Se comprueba **antes** de escribir en el storage: un archivo rechazado no debe
 * llegar a tocar el disco. Sin esto, 10 MB por archivo sin tope de conjunto
 * llenan el disco del VPS, y con el storage en local eso se lleva por delante
 * también a Mongo.
 *
 * @param {import('@/lib/auth/permissions').Ctx} ctx
 * @param {number} incomingBytes
 */
export async function assertStorageWithinPlan(ctx, incomingBytes) {
  const plan = await getPlan(ctx);
  const max = plan.storageBytes;
  if (max === null || max === undefined) return;

  const used = await currentStorageBytes(ctx.workspaceId);
  if (used + Number(incomingBytes || 0) > max) {
    const mb = Math.round(max / 1024 / 1024);
    throw new ForbiddenError(
      `Has alcanzado el espacio de ${mb} MB para adjuntos del plan ${plan.label}. ` +
        `Borra archivos o mejora el plan.`,
      { code: 'PLAN_LIMIT' },
    );
  }
}
