import mongoose from 'mongoose';

/**
 * Colección polimórfica única de registros. Ver CLAUDE.md para el porqué de una
 * sola colección y su trade-off. `data` guarda los valores por `fieldMetadata.name`.
 *
 * En la Fase 2 se introduce el modelo con sus índices base; el servicio genérico
 * de registros (CRUD, query builder, relaciones) llega en la Fase 3.
 *
 * @typedef {object} RecordDoc
 * @property {import('mongoose').Types.ObjectId} workspaceId
 * @property {import('mongoose').Types.ObjectId} objectMetadataId
 * @property {Record<string, any>} data
 * @property {string} position  fractional indexing (string)
 * @property {string} searchText
 * @property {{ userId: string, name: string, source: string }} createdBy
 * @property {Date} [deletedAt]
 */

const createdBySchema = new mongoose.Schema(
  {
    userId: { type: String, default: null },
    name: { type: String, default: '' },
    source: { type: String, enum: ['MANUAL', 'API', 'IMPORT', 'SYSTEM', 'FORM'], default: 'MANUAL' },
  },
  { _id: false },
);

const recordSchema = new mongoose.Schema(
  {
    workspaceId: { type: mongoose.Schema.Types.ObjectId, ref: 'Workspace', required: true },
    objectMetadataId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'ObjectMetadata',
      required: true,
    },
    data: { type: mongoose.Schema.Types.Mixed, default: {} },
    position: { type: String, default: null },
    searchText: { type: String, default: '' },
    createdBy: { type: createdBySchema, default: () => ({}) },
    deletedAt: { type: Date, default: null },
  },
  { timestamps: true, minimize: false },
);

// Índices base (los índices sobre data.<campo> son dinámicos, en lib/db/indexes.js).
recordSchema.index({ workspaceId: 1, objectMetadataId: 1, deletedAt: 1, createdAt: -1 });
// Orden por defecto (`position`, con `_id` de desempate) filtrando borrados: con
// `deletedAt` en la clave y `_id` al final, la lista queda totalmente cubierta
// por índice (igualdad ws/objeto/deletedAt + orden position,_id) → sin etapa SORT.
recordSchema.index({ workspaceId: 1, objectMetadataId: 1, deletedAt: 1, position: 1, _id: 1 });
recordSchema.index({ searchText: 'text' });

export const Record = mongoose.models.Record || mongoose.model('Record', recordSchema);
export default Record;
