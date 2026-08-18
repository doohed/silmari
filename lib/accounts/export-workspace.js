import { connectToDatabase } from '@/lib/db/connect';
import { assertTenant } from '@/lib/services/tenant';
import { can } from '@/lib/auth/permissions';
import { listObjects } from '@/lib/metadata/object-service';
import { ForbiddenError } from '@/lib/errors/domain-errors';
import { logger } from '@/lib/utils/logger';
import Activity from '@/models/Activity';
import Attachment from '@/models/Attachment';
import FieldMetadata from '@/models/FieldMetadata';
import Record from '@/models/Record';
import User from '@/models/User';
import Workspace from '@/models/Workspace';
import WorkspaceMember from '@/models/WorkspaceMember';

/**
 * Exportación completa del espacio de trabajo, para el derecho de portabilidad
 * del RGPD (artículo 20) y para que nadie se sienta secuestrado por el producto.
 *
 * Formato JSON en vez de CSV a propósito: los registros tienen campos definidos
 * por el usuario, relaciones y valores compuestos, y un CSV plano perdería la
 * estructura. Se incluye la **metadata** (objetos y campos) para que el volcado
 * sea interpretable sin la aplicación, que es justo lo que exige el "formato
 * estructurado y de uso común".
 *
 * Lo que **no** lleva: contraseñas, tokens, secretos de integraciones y binarios
 * de adjuntos. De los adjuntos va el inventario (nombre, tipo, tamaño), no el
 * contenido; incluirlos convertiría el JSON en algo inmanejable.
 */

/** Reemplaza los ObjectId por cadenas y quita los campos internos de Mongo. */
function clean(doc) {
  const { __v, ...rest } = doc;
  return JSON.parse(JSON.stringify(rest));
}

/**
 * @param {import('@/lib/auth/permissions').Ctx} ctx
 * @returns {Promise<object>} el volcado completo, listo para serializar
 */
export async function exportWorkspace(ctx) {
  assertTenant(ctx);
  // Exportar saca TODO el contenido del workspace: no es una acción de cualquier
  // miembro.
  if (!can(ctx, 'workspace:update')) {
    throw new ForbiddenError('No puedes exportar este espacio de trabajo');
  }
  await connectToDatabase();

  const [workspace, objects, members] = await Promise.all([
    Workspace.findById(ctx.workspaceId).lean(),
    listObjects(ctx, { includeInactive: true }),
    WorkspaceMember.find({ workspaceId: ctx.workspaceId }).lean(),
  ]);

  const memberUsers = await User.find({ _id: { $in: members.map((m) => m.userId) } })
    .select('email firstName lastName createdAt')
    .lean();

  const [fields, records, activities, attachments] = await Promise.all([
    FieldMetadata.find({ workspaceId: ctx.workspaceId, deletedAt: null }).lean(),
    Record.find({ workspaceId: ctx.workspaceId, deletedAt: null }).lean(),
    Activity.find({ workspaceId: ctx.workspaceId, deletedAt: null }).lean(),
    Attachment.find({ workspaceId: ctx.workspaceId, deletedAt: null })
      .select('name mimeType size createdAt targets')
      .lean(),
  ]);

  logger.info('Exportación de workspace', {
    workspaceId: String(ctx.workspaceId),
    records: records.length,
  });

  return {
    exportedAt: new Date().toISOString(),
    formatVersion: 1,
    workspace: {
      name: workspace?.name,
      slug: workspace?.slug,
      settings: workspace?.settings ?? {},
      createdAt: workspace?.createdAt,
    },
    members: memberUsers.map((u) => ({
      email: u.email,
      firstName: u.firstName,
      lastName: u.lastName,
      role: members.find((m) => String(m.userId) === String(u._id))?.role ?? null,
    })),
    // La metadata va antes que los datos: sin ella, `data` es un diccionario
    // opaco de nombres de campo.
    objects: objects.map((o) => ({
      slug: o.slug,
      labelSingular: o.labelSingular,
      labelPlural: o.labelPlural,
      isCustom: o.isCustom,
      fields: fields
        .filter((f) => String(f.objectMetadataId) === String(o.id))
        .map((f) => ({
          name: f.name,
          label: f.label,
          type: f.type,
          options: f.options ?? undefined,
        })),
    })),
    records: records.map((r) => {
      const object = objects.find((o) => String(o.id) === String(r.objectMetadataId));
      return {
        object: object?.slug ?? null,
        data: clean(r.data ?? {}),
        createdAt: r.createdAt,
        createdBy: r.createdBy?.name ?? null,
      };
    }),
    activities: activities.map((a) => ({
      type: a.type,
      title: a.title ?? null,
      body: a.body ?? null,
      dueAt: a.dueAt ?? null,
      createdAt: a.createdAt,
    })),
    // Solo el inventario: los binarios se descargan uno a uno desde la app.
    attachments: attachments.map((a) => ({
      name: a.name,
      mimeType: a.mimeType,
      size: a.size,
      createdAt: a.createdAt,
    })),
  };
}
