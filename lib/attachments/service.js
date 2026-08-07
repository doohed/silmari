import { connectToDatabase } from '@/lib/db/connect';
import { assertTenant } from '@/lib/services/tenant';
import { NotFoundError } from '@/lib/errors/domain-errors';
import { getStorage } from '@/lib/storage';
import Attachment from '@/models/Attachment';

export function toAttachmentDTO(a) {
  return {
    id: String(a._id),
    name: a.name,
    mimeType: a.mimeType,
    size: a.size,
    storageKey: a.storageKey,
    createdAt: a.createdAt,
    targets: (a.targets ?? []).map((t) => ({
      objectMetadataId: String(t.objectMetadataId),
      recordId: String(t.recordId),
    })),
  };
}

/**
 * Registra un adjunto (tras subir el binario al storage).
 * @param {import('@/lib/auth/permissions').Ctx} ctx
 * @param {{ name:string, mimeType:string, size:number, storageKey:string, targets:Array }} input
 */
export async function createAttachment(ctx, input) {
  assertTenant(ctx);
  await connectToDatabase();
  const doc = await Attachment.create({
    workspaceId: ctx.workspaceId,
    name: input.name,
    mimeType: input.mimeType,
    size: input.size,
    storageKey: input.storageKey,
    targets: input.targets ?? [],
    uploadedBy: ctx.userId,
  });
  return toAttachmentDTO(doc);
}

/** Adjuntos de un registro. */
export async function listForRecord(ctx, { recordId }) {
  assertTenant(ctx);
  await connectToDatabase();
  const items = await Attachment.find({
    workspaceId: ctx.workspaceId,
    'targets.recordId': recordId,
    deletedAt: null,
  })
    .sort({ createdAt: -1 })
    .lean();
  return items.map(toAttachmentDTO);
}

/** Devuelve el binario y metadata de un adjunto (para servirlo). */
export async function readAttachment(ctx, id) {
  assertTenant(ctx);
  await connectToDatabase();
  const a = await Attachment.findOne({
    _id: id,
    workspaceId: ctx.workspaceId,
    deletedAt: null,
  }).lean();
  if (!a) throw new NotFoundError('Adjunto no encontrado');
  const buffer = await getStorage().read(a.storageKey);
  return { buffer, mimeType: a.mimeType, name: a.name };
}

/** Borra (soft) un adjunto y elimina su binario. */
export async function deleteAttachment(ctx, id) {
  assertTenant(ctx);
  await connectToDatabase();
  const a = await Attachment.findOne({ _id: id, workspaceId: ctx.workspaceId, deletedAt: null });
  if (!a) throw new NotFoundError('Adjunto no encontrado');
  a.deletedAt = new Date();
  await a.save();
  await getStorage().remove(a.storageKey);
}
