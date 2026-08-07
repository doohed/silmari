import mongoose from 'mongoose';

/**
 * Definición de un objeto (estándar o custom). La UI (tabla, kanban, ficha) se
 * genera a partir de esta metadata + sus FieldMetadata.
 * @typedef {object} ObjectMetadataDoc
 * @property {import('mongoose').Types.ObjectId} workspaceId
 * @property {string} nameSingular  camelCase, p. ej. "company"
 * @property {string} namePlural    camelCase, p. ej. "companies"
 * @property {string} slug          URL-safe, único por workspace
 * @property {string} labelSingular Etiqueta visible singular
 * @property {string} labelPlural   Etiqueta visible plural
 * @property {boolean} isCustom
 * @property {boolean} isActive
 * @property {import('mongoose').Types.ObjectId} [labelIdentifierFieldId] Campo que actúa de "nombre"
 */

const objectMetadataSchema = new mongoose.Schema(
  {
    workspaceId: { type: mongoose.Schema.Types.ObjectId, ref: 'Workspace', required: true },
    nameSingular: { type: String, required: true },
    namePlural: { type: String, required: true },
    slug: { type: String, required: true },
    labelSingular: { type: String, required: true },
    labelPlural: { type: String, required: true },
    description: { type: String, default: '' },
    icon: { type: String, default: 'Circle' },
    isCustom: { type: Boolean, default: true },
    isActive: { type: Boolean, default: true },
    labelIdentifierFieldId: { type: mongoose.Schema.Types.ObjectId, default: null },
    imageIdentifierFieldId: { type: mongoose.Schema.Types.ObjectId, default: null },
    position: { type: Number, default: 0 },
    deletedAt: { type: Date, default: null },
  },
  { timestamps: true },
);

// Unicidad del slug por workspace, pero solo entre objetos vivos: un objeto
// borrado (soft delete) no ocupa el slug, así puede reutilizarse el nombre.
objectMetadataSchema.index(
  { workspaceId: 1, slug: 1 },
  { unique: true, partialFilterExpression: { deletedAt: null } },
);

export const ObjectMetadata =
  mongoose.models.ObjectMetadata || mongoose.model('ObjectMetadata', objectMetadataSchema);
export default ObjectMetadata;
