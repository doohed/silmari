import mongoose from 'mongoose';

/**
 * Conexión saliente de un workspace con un proveedor de comunicaciones. El
 * secreto (contraseña SMTP, token de la Cloud API de Meta) se guarda **cifrado**
 * en `secret`; `config` guarda lo no sensible (host, puerto, from, phoneNumberId…).
 * Un tipo por workspace (`kind` único por `workspaceId`).
 * @typedef {object} IntegrationDoc
 * @property {'EMAIL_SMTP'|'WHATSAPP'} kind
 * @property {object} config
 * @property {string} secret  cifrado con lib/utils/crypto
 */
const integrationSchema = new mongoose.Schema(
  {
    workspaceId: { type: mongoose.Schema.Types.ObjectId, ref: 'Workspace', required: true },
    kind: { type: String, enum: ['EMAIL_SMTP', 'WHATSAPP'], required: true },
    config: { type: mongoose.Schema.Types.Mixed, default: {} },
    secret: { type: String, default: '' },
    isActive: { type: Boolean, default: true },
  },
  { timestamps: true },
);

integrationSchema.index({ workspaceId: 1, kind: 1 }, { unique: true });

export const Integration =
  mongoose.models.Integration || mongoose.model('Integration', integrationSchema);
export default Integration;
