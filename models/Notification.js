import mongoose from 'mongoose';

/**
 * Notificación in-app dirigida a un usuario del workspace. Las genera el sistema
 * (suscriptor del bus de eventos), no una acción directa de usuario. `readAt`
 * marca si ya se leyó; `entity` apunta al recurso origen y `url` a dónde llevar
 * al hacer clic. El nombre/avatar del actor se hidrata al leer (no se denormaliza).
 * @typedef {object} NotificationDoc
 * @property {string} type     p. ej. 'task.assigned'
 * @property {string} title    texto principal, ya en lenguaje humano
 * @property {string} body     detalle (p. ej. el título de la tarea)
 */
const notificationSchema = new mongoose.Schema(
  {
    workspaceId: { type: mongoose.Schema.Types.ObjectId, ref: 'Workspace', required: true },
    userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    type: { type: String, required: true },
    title: { type: String, required: true },
    body: { type: String, default: '' },
    entity: {
      type: new mongoose.Schema(
        { kind: { type: String }, id: { type: String } },
        { _id: false },
      ),
      default: null,
    },
    actorId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
    url: { type: String, default: null },
    readAt: { type: Date, default: null },
  },
  { timestamps: true },
);

// Bandeja del usuario: no leídas primero por conteo, y listado por fecha.
notificationSchema.index({ workspaceId: 1, userId: 1, readAt: 1, createdAt: -1 });

export const Notification =
  mongoose.models.Notification || mongoose.model('Notification', notificationSchema);
export default Notification;
