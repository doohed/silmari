import mongoose from 'mongoose';

/**
 * Apunte personal del usuario: una libreta propia, independiente de las notas
 * de actividad (`Activity` type NOTE) que cuelgan de registros. No se vincula a
 * ningún objeto ni registro; es privada del usuario dentro del workspace.
 * @typedef {object} UserNoteDoc
 * @property {import('mongoose').Types.ObjectId} workspaceId
 * @property {import('mongoose').Types.ObjectId} userId  Dueño (privada).
 * @property {string} title
 * @property {any} body  JSON de Tiptap.
 * @property {boolean} pinned
 * @property {Date} [deletedAt]
 */

const userNoteSchema = new mongoose.Schema(
  {
    workspaceId: { type: mongoose.Schema.Types.ObjectId, ref: 'Workspace', required: true },
    userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    title: { type: String, default: '', trim: true },
    body: { type: mongoose.Schema.Types.Mixed, default: null },
    pinned: { type: Boolean, default: false },
    deletedAt: { type: Date, default: null },
  },
  { timestamps: true },
);

// Libreta del usuario: los suyos, no borrados, fijados primero y recientes antes.
userNoteSchema.index({ workspaceId: 1, userId: 1, deletedAt: 1, pinned: -1, updatedAt: -1 });

export const UserNote = mongoose.models.UserNote || mongoose.model('UserNote', userNoteSchema);
export default UserNote;
