import mongoose from 'mongoose';

/**
 * LeadIntake: configuración de entrada de leads desde un formulario externo
 * (hoy Meta Lead Ads vía Zapier/Make). Define a qué objeto van los leads de un
 * `formId` y cómo se traducen las preguntas del formulario a campos del CRM.
 *
 * `formId` vacío actúa de comodín: recoge los leads cuyo formulario no tiene
 * una configuración propia.
 *
 * @typedef {object} LeadIntakeDoc
 * @property {string} name          Nombre para la UI, p. ej. "Campaña verano"
 * @property {string} provider      'META' (único proveedor por ahora)
 * @property {string} formId        form_id de Meta; '' = comodín
 * @property {string} objectMetadataId  Objeto destino
 * @property {Array<{ source: string, fieldName: string }>} mappings
 * @property {string|null} dedupeFieldName  Campo clave; si ya existe, actualiza
 * @property {boolean} isActive
 */

const mappingSchema = new mongoose.Schema(
  {
    /** Nombre de la pregunta en el formulario de Meta (p. ej. `email`). */
    source: { type: String, required: true },
    /** `fieldMetadata.name` del objeto destino. */
    fieldName: { type: String, required: true },
  },
  { _id: false },
);

const logSchema = new mongoose.Schema(
  {
    at: { type: Date, default: Date.now },
    ok: { type: Boolean, default: false },
    /** 'created' | 'updated' | 'error' */
    action: { type: String, required: true },
    leadId: { type: String, default: null },
    recordId: { type: mongoose.Schema.Types.ObjectId, default: null },
    message: { type: String, default: '' },
  },
  { _id: true },
);

const leadIntakeSchema = new mongoose.Schema(
  {
    workspaceId: { type: mongoose.Schema.Types.ObjectId, ref: 'Workspace', required: true },
    name: { type: String, required: true },
    provider: { type: String, default: 'META' },
    formId: { type: String, default: '' },
    objectMetadataId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'ObjectMetadata',
      required: true,
    },
    mappings: { type: [mappingSchema], default: [] },
    dedupeFieldName: { type: String, default: null },
    isActive: { type: Boolean, default: true },
    stats: {
      received: { type: Number, default: 0 },
      created: { type: Number, default: 0 },
      updated: { type: Number, default: 0 },
      failed: { type: Number, default: 0 },
    },
    lastReceivedAt: { type: Date, default: null },
    log: { type: [logSchema], default: [] },
  },
  { timestamps: true },
);

// Una sola configuración por formulario y proveedor: evita que dos configs
// compitan por el mismo lead entrante.
leadIntakeSchema.index({ workspaceId: 1, provider: 1, formId: 1 }, { unique: true });

export const LeadIntake =
  mongoose.models.LeadIntake || mongoose.model('LeadIntake', leadIntakeSchema);
export default LeadIntake;
