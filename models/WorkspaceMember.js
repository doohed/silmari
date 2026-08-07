import mongoose from 'mongoose';

/**
 * Pertenencia de un usuario a un workspace, con su rol.
 * @typedef {'OWNER'|'ADMIN'|'MEMBER'} Role
 * @typedef {object} WorkspaceMemberDoc
 * @property {import('mongoose').Types.ObjectId} workspaceId
 * @property {import('mongoose').Types.ObjectId} userId
 * @property {Role} role
 * @property {string} [jobTitle] Puesto en la empresa (se fija en el onboarding).
 * @property {import('mongoose').Types.ObjectId} [invitedBy]
 * @property {Date} joinedAt
 */

const workspaceMemberSchema = new mongoose.Schema(
  {
    workspaceId: { type: mongoose.Schema.Types.ObjectId, ref: 'Workspace', required: true },
    userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
    role: { type: String, enum: ['OWNER', 'ADMIN', 'MEMBER'], default: 'MEMBER' },
    jobTitle: { type: String, default: '', trim: true },
    invitedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
    joinedAt: { type: Date, default: Date.now },
  },
  { timestamps: true },
);

// Un usuario no puede estar dos veces en el mismo workspace.
workspaceMemberSchema.index({ workspaceId: 1, userId: 1 }, { unique: true });

export const WorkspaceMember =
  mongoose.models.WorkspaceMember || mongoose.model('WorkspaceMember', workspaceMemberSchema);
export default WorkspaceMember;
