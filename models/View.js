import mongoose from 'mongoose';

/**
 * Vista de un objeto: define columnas visibles/orden/tamaño, filtros, orden y
 * (para kanban) el campo de agrupación. La UI de tabla/kanban se configura desde
 * aquí.
 */

const viewFieldSchema = new mongoose.Schema(
  {
    fieldMetadataId: { type: mongoose.Schema.Types.ObjectId, ref: 'FieldMetadata', required: true },
    isVisible: { type: Boolean, default: true },
    position: { type: Number, default: 0 },
    size: { type: Number, default: 180 },
  },
  { _id: false },
);

const viewFilterSchema = new mongoose.Schema(
  {
    fieldMetadataId: { type: mongoose.Schema.Types.ObjectId, ref: 'FieldMetadata', required: true },
    operator: { type: String, required: true },
    value: { type: mongoose.Schema.Types.Mixed, default: null },
  },
  { _id: false },
);

const viewSortSchema = new mongoose.Schema(
  {
    fieldMetadataId: { type: mongoose.Schema.Types.ObjectId, ref: 'FieldMetadata', required: true },
    direction: { type: String, enum: ['asc', 'desc'], default: 'asc' },
  },
  { _id: false },
);

const viewSchema = new mongoose.Schema(
  {
    workspaceId: { type: mongoose.Schema.Types.ObjectId, ref: 'Workspace', required: true },
    objectMetadataId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'ObjectMetadata',
      required: true,
    },
    name: { type: String, required: true },
    type: { type: String, enum: ['TABLE', 'KANBAN'], default: 'TABLE' },
    icon: { type: String, default: 'Table' },
    isDefault: { type: Boolean, default: false },
    position: { type: Number, default: 0 },
    kanbanFieldMetadataId: { type: mongoose.Schema.Types.ObjectId, default: null },
    viewFields: { type: [viewFieldSchema], default: [] },
    viewFilters: { type: [viewFilterSchema], default: [] },
    viewSorts: { type: [viewSortSchema], default: [] },
    viewGroups: { type: [mongoose.Schema.Types.Mixed], default: [] },
    deletedAt: { type: Date, default: null },
  },
  { timestamps: true },
);

viewSchema.index({ workspaceId: 1, objectMetadataId: 1, position: 1 });

export const View = mongoose.models.View || mongoose.model('View', viewSchema);
export default View;
