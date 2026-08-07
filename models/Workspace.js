import mongoose from 'mongoose';

/**
 * Workspace: unidad de multi-tenancy. Todo dato de negocio lleva `workspaceId`.
 * @typedef {object} WorkspaceDoc
 * @property {string} name
 * @property {string} slug
 * @property {string} [logoUrl]
 * @property {{ theme: string, currency: string, timezone: string }} settings
 * @property {Date} [deletedAt]
 */

const settingsSchema = new mongoose.Schema(
  {
    theme: { type: String, default: 'light' },
    currency: { type: String, default: 'EUR' },
    timezone: { type: String, default: 'Europe/Madrid' },
  },
  { _id: false },
);

const workspaceSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true },
    slug: { type: String, required: true, unique: true, lowercase: true, trim: true },
    logoUrl: { type: String, default: null },
    settings: { type: settingsSchema, default: () => ({}) },
    deletedAt: { type: Date, default: null },
  },
  { timestamps: true },
);

export const Workspace = mongoose.models.Workspace || mongoose.model('Workspace', workspaceSchema);
export default Workspace;
