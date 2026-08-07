import mongoose from 'mongoose';

/**
 * Panel de un workspace: una lista ordenada de widgets (de un catálogo fijo).
 * La configuración de cada widget vive en el catálogo (`lib/dashboards/catalog.js`);
 * aquí solo guardamos su `type` y su orden.
 * @typedef {object} DashboardDoc
 * @property {import('mongoose').Types.ObjectId} workspaceId
 * @property {string} name
 * @property {Array<{ id: string, type: string }>} widgets
 * @property {string} [position] Clave de orden (fractional indexing).
 * @property {import('mongoose').Types.ObjectId} createdBy
 * @property {Date} [deletedAt]
 */

const widgetSchema = new mongoose.Schema(
  {
    id: { type: String, required: true },
    type: { type: String, required: true },
    // Tamaño en unidades de la rejilla (columnas × filas). Rejilla de 4 columnas.
    // Sin default: si falta, el DTO aplica el tamaño por tipo (stat 1×1, resto 2×2).
    w: { type: Number, min: 1, max: 4 },
    h: { type: Number, min: 1, max: 3 },
  },
  { _id: false },
);

const dashboardSchema = new mongoose.Schema(
  {
    workspaceId: { type: mongoose.Schema.Types.ObjectId, ref: 'Workspace', required: true },
    name: { type: String, default: 'Mi panel', trim: true },
    widgets: { type: [widgetSchema], default: [] },
    // Orden manual entre paneles (fractional indexing, clave string). Ver CLAUDE.md.
    position: { type: String, default: null },
    createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
    deletedAt: { type: Date, default: null },
  },
  { timestamps: true },
);

dashboardSchema.index({ workspaceId: 1, deletedAt: 1, position: 1 });

export const Dashboard = mongoose.models.Dashboard || mongoose.model('Dashboard', dashboardSchema);
export default Dashboard;
