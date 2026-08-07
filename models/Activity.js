import mongoose from 'mongoose';

/**
 * Nota o tarea. `targets` es polimórfico: una misma actividad puede colgar de
 * varios registros (de cualquier objeto), y aparece en la ficha de todos ellos.
 * @typedef {object} ActivityDoc
 * @property {'NOTE'|'TASK'} type
 * @property {string} title
 * @property {any} body  JSON de Tiptap (notas)
 * @property {'TODO'|'IN_PROGRESS'|'DONE'} status  (tareas)
 * @property {Date} [dueAt]  fecha límite (tareas)
 * @property {Array<any>} assigneeIds  responsables (tareas)
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

const activitySchema = new mongoose.Schema(
  {
    workspaceId: { type: mongoose.Schema.Types.ObjectId, ref: 'Workspace', required: true },
    type: { type: String, enum: ['NOTE', 'TASK'], required: true },
    title: { type: String, default: '' },
    body: { type: mongoose.Schema.Types.Mixed, default: null },
    status: { type: String, enum: ['TODO', 'IN_PROGRESS', 'DONE'], default: 'TODO' },
    dueAt: { type: Date, default: null },
    assigneeIds: { type: [{ type: mongoose.Schema.Types.ObjectId, ref: 'User' }], default: [] },
    authorId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    targets: { type: [targetSchema], default: [] },
    completedAt: { type: Date, default: null },
    deletedAt: { type: Date, default: null },
  },
  { timestamps: true },
);

activitySchema.index({ workspaceId: 1, type: 1, deletedAt: 1, createdAt: -1 });
// Consulta por registro (targets.recordId) y bandeja por responsable/estado.
activitySchema.index({ workspaceId: 1, 'targets.recordId': 1 });
activitySchema.index({ workspaceId: 1, type: 1, assigneeIds: 1, status: 1 });
// Calendario: tareas por fecha límite.
activitySchema.index({ workspaceId: 1, type: 1, dueAt: 1 });

export const Activity = mongoose.models.Activity || mongoose.model('Activity', activitySchema);
export default Activity;
