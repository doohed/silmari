import mongoose from 'mongoose';

/**
 * Invitación a un workspace, aceptable mediante un token de un solo uso.
 * @typedef {object} InvitationDoc
 * @property {import('mongoose').Types.ObjectId} workspaceId
 * @property {string} email
 * @property {'OWNER'|'ADMIN'|'MEMBER'} role
 * @property {string} token Hash del token (nunca el token en claro).
 * @property {Date} expiresAt
 * @property {Date} [acceptedAt]
 * @property {import('mongoose').Types.ObjectId} invitedBy
 */

const invitationSchema = new mongoose.Schema(
  {
    workspaceId: { type: mongoose.Schema.Types.ObjectId, ref: 'Workspace', required: true },
    email: { type: String, required: true, lowercase: true, trim: true },
    role: { type: String, enum: ['ADMIN', 'MEMBER'], default: 'MEMBER' },
    // Guardamos el hash del token; el token en claro solo viaja en el enlace.
    token: { type: String, required: true, unique: true },
    expiresAt: { type: Date, required: true },
    acceptedAt: { type: Date, default: null },
    invitedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  },
  { timestamps: true },
);

// Una invitación pendiente por email y workspace (las aceptadas no cuentan).
invitationSchema.index(
  { workspaceId: 1, email: 1 },
  { unique: true, partialFilterExpression: { acceptedAt: null } },
);

export const Invitation =
  mongoose.models.Invitation || mongoose.model('Invitation', invitationSchema);
export default Invitation;
