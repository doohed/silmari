import mongoose from 'mongoose';

/**
 * Archivo adjunto vinculado a uno o varios registros (targets polimórficos).
 * El binario vive en el storage (disco local en dev); aquí solo la metadata.
 * @typedef {object} AttachmentDoc
 * @property {string} name
 * @property {string} mimeType
 * @property {number} size
 * @property {string} storageKey
 * @property {Array<{ objectMetadataId: any, recordId: any }>} targets
 */

const targetSchema = new mongoose.Schema(
  {
    objectMetadataId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'ObjectMetadata',
      required: true,
    },
    recordId: { type: mongoose.Schema.Types.ObjectId, ref: 'Record', required: true },
  },
  { _id: false },
);

const attachmentSchema = new mongoose.Schema(
  {
    workspaceId: { type: mongoose.Schema.Types.ObjectId, ref: 'Workspace', required: true },
    name: { type: String, required: true },
    mimeType: { type: String, default: 'application/octet-stream' },
    size: { type: Number, default: 0 },
    storageKey: { type: String, required: true },
    targets: { type: [targetSchema], default: [] },
    uploadedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
    deletedAt: { type: Date, default: null },
  },
  { timestamps: true },
);

attachmentSchema.index({ workspaceId: 1, 'targets.recordId': 1 });

export const Attachment =
  mongoose.models.Attachment || mongoose.model('Attachment', attachmentSchema);
export default Attachment;
