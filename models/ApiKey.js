import mongoose from 'mongoose';

/**
 * API key para la API pública `/api/v1`. Nunca se guarda el token en claro, solo
 * su hash (sha256). `prefix` permite identificarla en la UI/logs.
 * @typedef {object} ApiKeyDoc
 * @property {import('mongoose').Types.ObjectId} workspaceId
 * @property {string} name
 * @property {string} tokenHash
 * @property {string} prefix
 * @property {string[]} scopes  p. ej. ['records:read','records:write']
 * @property {Date} [expiresAt]
 * @property {Date} [revokedAt]
 * @property {Date} [lastUsedAt]
 */

const apiKeySchema = new mongoose.Schema(
  {
    workspaceId: { type: mongoose.Schema.Types.ObjectId, ref: 'Workspace', required: true },
    name: { type: String, required: true },
    tokenHash: { type: String, required: true, unique: true },
    prefix: { type: String, required: true },
    scopes: { type: [String], default: ['records:read', 'records:write'] },
    createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'User', default: null },
    expiresAt: { type: Date, default: null },
    revokedAt: { type: Date, default: null },
    lastUsedAt: { type: Date, default: null },
  },
  { timestamps: true },
);

apiKeySchema.index({ workspaceId: 1, revokedAt: 1 });

export const ApiKey = mongoose.models.ApiKey || mongoose.model('ApiKey', apiKeySchema);
export default ApiKey;
