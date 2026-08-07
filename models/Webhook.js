import mongoose from 'mongoose';

/**
 * Webhook: notifica a una URL externa en eventos de registro. `deliveryLog`
 * guarda el historial reciente de entregas (para inspección y reintento).
 * @typedef {object} WebhookDoc
 * @property {string} targetUrl
 * @property {string[]} operations  p. ej. ['company.created', 'person.updated']
 * @property {string} secret  para firmar el payload (HMAC-SHA256)
 * @property {boolean} isActive
 */

const deliverySchema = new mongoose.Schema(
  {
    operation: { type: String, required: true },
    ok: { type: Boolean, default: false },
    statusCode: { type: Number, default: null },
    error: { type: String, default: null },
    requestBody: { type: String, default: '' },
    responseSnippet: { type: String, default: '' },
    at: { type: Date, default: Date.now },
  },
  { _id: true },
);

const webhookSchema = new mongoose.Schema(
  {
    workspaceId: { type: mongoose.Schema.Types.ObjectId, ref: 'Workspace', required: true },
    targetUrl: { type: String, required: true },
    operations: { type: [String], default: [] },
    secret: { type: String, required: true },
    isActive: { type: Boolean, default: true },
    deliveryLog: { type: [deliverySchema], default: [] },
  },
  { timestamps: true },
);

webhookSchema.index({ workspaceId: 1, isActive: 1 });

export const Webhook = mongoose.models.Webhook || mongoose.model('Webhook', webhookSchema);
export default Webhook;
