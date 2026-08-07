import mongoose from 'mongoose';

/**
 * Definición de un campo de un objeto. `name` es la key dentro de `records.data`.
 * @typedef {object} FieldMetadataDoc
 * @property {import('mongoose').Types.ObjectId} workspaceId
 * @property {import('mongoose').Types.ObjectId} objectMetadataId
 * @property {string} name  camelCase
 * @property {string} label
 * @property {string} type  uno del registry lib/field-types
 * @property {boolean} isNullable
 * @property {boolean} isUnique
 * @property {boolean} isIndexed  Indexar data.<name> aunque no sea único
 * @property {boolean} isSystem   Campo de sistema (no borrable por el usuario)
 * @property {Array<{ id: string, label: string, value: string, color: string, position: number }>} options
 * @property {{ type: string, targetObjectMetadataId: any, targetFieldName: string, onDelete: string }} [relation]
 */

const optionSchema = new mongoose.Schema(
  {
    id: { type: String, required: true },
    label: { type: String, required: true },
    value: { type: String, required: true },
    color: { type: String, default: 'gray' },
    position: { type: Number, default: 0 },
  },
  { _id: false },
);

const relationSchema = new mongoose.Schema(
  {
    type: { type: String, enum: ['ONE_TO_MANY', 'MANY_TO_ONE', 'MANY_TO_MANY'] },
    targetObjectMetadataId: { type: mongoose.Schema.Types.ObjectId, ref: 'ObjectMetadata' },
    targetFieldName: { type: String },
    onDelete: { type: String, enum: ['CASCADE', 'SET_NULL', 'RESTRICT'], default: 'SET_NULL' },
  },
  { _id: false },
);

const fieldMetadataSchema = new mongoose.Schema(
  {
    workspaceId: { type: mongoose.Schema.Types.ObjectId, ref: 'Workspace', required: true },
    objectMetadataId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'ObjectMetadata',
      required: true,
    },
    name: { type: String, required: true },
    label: { type: String, required: true },
    description: { type: String, default: '' },
    type: { type: String, required: true },
    icon: { type: String, default: null },
    isNullable: { type: Boolean, default: true },
    isUnique: { type: Boolean, default: false },
    isIndexed: { type: Boolean, default: false },
    isCustom: { type: Boolean, default: true },
    isSystem: { type: Boolean, default: false },
    isActive: { type: Boolean, default: true },
    defaultValue: { type: mongoose.Schema.Types.Mixed, default: null },
    position: { type: Number, default: 0 },
    settings: { type: mongoose.Schema.Types.Mixed, default: {} },
    options: { type: [optionSchema], default: undefined },
    relation: { type: relationSchema, default: undefined },
    deletedAt: { type: Date, default: null },
  },
  { timestamps: true },
);

fieldMetadataSchema.index({ workspaceId: 1, objectMetadataId: 1, name: 1 }, { unique: true });

export const FieldMetadata =
  mongoose.models.FieldMetadata || mongoose.model('FieldMetadata', fieldMetadataSchema);
export default FieldMetadata;
