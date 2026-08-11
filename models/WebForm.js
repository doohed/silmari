import mongoose from 'mongoose';

/**
 * Formulario web nativo e integrable. A diferencia de `LeadIntake` (entrante de
 * Meta vía API key), este es **público**: cualquier visitante sin cuenta lo
 * rellena y crea/actualiza un registro. `slug` es la clave de la URL pública
 * (`/forms/<slug>`) y es único global. Cada `field` es un campo del objeto
 * destino, así que el mapeo es directo (source = fieldName).
 * @typedef {object} WebFormDoc
 * @property {string} name
 * @property {string} slug
 * @property {Array<{ fieldName:string, label:string, required:boolean, placeholder:string }>} fields
 * @property {string|null} dedupeFieldName  Campo clave: si ya existe, actualiza
 */
const formFieldSchema = new mongoose.Schema(
  {
    fieldName: { type: String, required: true },
    label: { type: String, default: '' },
    required: { type: Boolean, default: false },
    placeholder: { type: String, default: '' },
  },
  { _id: false },
);

const webFormSchema = new mongoose.Schema(
  {
    workspaceId: { type: mongoose.Schema.Types.ObjectId, ref: 'Workspace', required: true },
    name: { type: String, required: true },
    slug: { type: String, required: true, unique: true },
    objectMetadataId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'ObjectMetadata',
      required: true,
    },
    fields: { type: [formFieldSchema], default: [] },
    dedupeFieldName: { type: String, default: null },
    submitLabel: { type: String, default: 'Enviar' },
    successMessage: { type: String, default: '¡Gracias! Hemos recibido tu mensaje.' },
    redirectUrl: { type: String, default: null },
    isActive: { type: Boolean, default: true },
    stats: {
      submissions: { type: Number, default: 0 },
      created: { type: Number, default: 0 },
      updated: { type: Number, default: 0 },
    },
  },
  { timestamps: true },
);

webFormSchema.index({ workspaceId: 1, createdAt: -1 });

export const WebForm = mongoose.models.WebForm || mongoose.model('WebForm', webFormSchema);
export default WebForm;
