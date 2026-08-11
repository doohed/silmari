import mongoose from 'mongoose';

/**
 * Plantilla de mensaje reutilizable con variables `{{campo}}`. La usarán el
 * email integrado y WhatsApp (canal `channel`); `objectSlug` acota a qué objeto
 * apuntan sus variables (opcional). `subject` solo tiene sentido para EMAIL.
 * @typedef {object} MessageTemplateDoc
 * @property {string} name
 * @property {'EMAIL'|'WHATSAPP'|'GENERIC'} channel
 * @property {string} subject
 * @property {string} body
 */
const templateSchema = new mongoose.Schema(
  {
    workspaceId: { type: mongoose.Schema.Types.ObjectId, ref: 'Workspace', required: true },
    name: { type: String, required: true },
    channel: { type: String, enum: ['EMAIL', 'WHATSAPP', 'GENERIC'], default: 'EMAIL' },
    objectSlug: { type: String, default: null },
    subject: { type: String, default: '' },
    body: { type: String, required: true },
  },
  { timestamps: true },
);

templateSchema.index({ workspaceId: 1, channel: 1 });

export const MessageTemplate =
  mongoose.models.MessageTemplate || mongoose.model('MessageTemplate', templateSchema);
export default MessageTemplate;
