import mongoose from 'mongoose';

/**
 * Nota, tarea o comunicación (email/WhatsApp). `targets` es polimórfico: una
 * misma actividad puede colgar de varios registros (de cualquier objeto) y
 * aparece en la ficha de todos ellos. Para EMAIL/WHATSAPP, `title` es el asunto,
 * `body` el texto y `comm` guarda los metadatos del mensaje.
 * @typedef {object} ActivityDoc
 * @property {'NOTE'|'TASK'|'EMAIL'|'WHATSAPP'} type
 * @property {string} title
 * @property {any} body  JSON de Tiptap (notas) o texto (comunicaciones)
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

// Metadatos de una comunicación (EMAIL/WHATSAPP). `provider` = 'MANUAL' cuando la
// registra una persona a mano; cambiará cuando se conecten Gmail/Outlook/Meta.
const commSchema = new mongoose.Schema(
  {
    channel: { type: String, enum: ['EMAIL', 'WHATSAPP'] },
    direction: { type: String, enum: ['INBOUND', 'OUTBOUND'], default: 'OUTBOUND' },
    from: { type: String, default: '' },
    to: { type: [String], default: [] },
    provider: { type: String, default: 'MANUAL' },
    externalId: { type: String, default: null },
    occurredAt: { type: Date, default: Date.now },
  },
  { _id: false },
);

const activitySchema = new mongoose.Schema(
  {
    workspaceId: { type: mongoose.Schema.Types.ObjectId, ref: 'Workspace', required: true },
    type: { type: String, enum: ['NOTE', 'TASK', 'EMAIL', 'WHATSAPP'], required: true },
    title: { type: String, default: '' },
    body: { type: mongoose.Schema.Types.Mixed, default: null },
    status: { type: String, enum: ['TODO', 'IN_PROGRESS', 'DONE'], default: 'TODO' },
    dueAt: { type: Date, default: null },
    assigneeIds: { type: [{ type: mongoose.Schema.Types.ObjectId, ref: 'User' }], default: [] },
    authorId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    targets: { type: [targetSchema], default: [] },
    comm: { type: commSchema, default: null },
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
