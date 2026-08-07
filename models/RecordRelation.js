import mongoose from 'mongoose';

/**
 * Materializa una relación entre dos registros para poder consultarla en ambos
 * sentidos (y para MANY_TO_MANY). Para MANY_TO_ONE también se guarda el id en
 * `records.data`, pero el espejo aquí permite resolver el inverso eficientemente.
 * @typedef {object} RecordRelationDoc
 * @property {import('mongoose').Types.ObjectId} workspaceId
 * @property {import('mongoose').Types.ObjectId} fieldMetadataId  Campo RELATION propietario
 * @property {import('mongoose').Types.ObjectId} sourceRecordId
 * @property {import('mongoose').Types.ObjectId} targetRecordId
 */

const recordRelationSchema = new mongoose.Schema(
  {
    workspaceId: { type: mongoose.Schema.Types.ObjectId, ref: 'Workspace', required: true },
    fieldMetadataId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'FieldMetadata',
      required: true,
    },
    sourceRecordId: { type: mongoose.Schema.Types.ObjectId, ref: 'Record', required: true },
    targetRecordId: { type: mongoose.Schema.Types.ObjectId, ref: 'Record', required: true },
  },
  { timestamps: { createdAt: true, updatedAt: false } },
);

// Consultas en ambos sentidos.
recordRelationSchema.index({ workspaceId: 1, fieldMetadataId: 1, sourceRecordId: 1 });
recordRelationSchema.index({ workspaceId: 1, fieldMetadataId: 1, targetRecordId: 1 });
// Evita duplicar la misma arista.
recordRelationSchema.index(
  { fieldMetadataId: 1, sourceRecordId: 1, targetRecordId: 1 },
  { unique: true },
);

export const RecordRelation =
  mongoose.models.RecordRelation || mongoose.model('RecordRelation', recordRelationSchema);
export default RecordRelation;
