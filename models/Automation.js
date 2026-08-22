import mongoose from 'mongoose';

/**
 * Automatización: regla «cuando [disparador] y [condiciones] → [acciones]».
 * El disparador se casa contra eventos de dominio de registro; las condiciones
 * reusan los operadores de filtro de los field-types (se evalúan re-consultando
 * el registro); las acciones se ejecutan en orden. `runLog` guarda las últimas
 * ejecuciones para inspección.
 * @typedef {object} AutomationDoc
 * @property {{ event: string, objectSlug: string }} trigger
 * @property {Array<{ fieldName: string, operator: string, value: any }>} conditions
 * @property {Array<{ type: string, config: object }>} actions
 */

const conditionSchema = new mongoose.Schema(
  {
    fieldName: { type: String, required: true },
    operator: { type: String, required: true },
    value: { type: mongoose.Schema.Types.Mixed, default: null },
  },
  { _id: false },
);

const actionSchema = new mongoose.Schema(
  {
    type: { type: String, required: true }, // 'create_task' | 'update_field' | 'notify'
    config: { type: mongoose.Schema.Types.Mixed, default: {} },
  },
  { _id: false },
);

/**
 * Qué hizo una acción concreta. Sin esto, `actionsRun: 2` no distingue «avisé a
 * dos personas» de «ejecuté una acción `notify` sin destinatarios y no avisé a
 * nadie», que era justo lo que hacía indistinguible una regla rota de una que
 * funciona. La clave es `action` y no `type` a propósito: en un esquema de
 * Mongoose, `type` es la palabra que declara el tipo del campo.
 */
const runActionSchema = new mongoose.Schema(
  {
    action: { type: String, required: true },
    ok: { type: Boolean, default: true },
    detail: { type: String, default: '' },
  },
  { _id: false },
);

const runSchema = new mongoose.Schema(
  {
    at: { type: Date, default: Date.now },
    recordId: { type: String, default: null },
    ok: { type: Boolean, default: true },
    actionsRun: { type: Number, default: 0 },
    details: { type: [runActionSchema], default: [] },
    error: { type: String, default: null },
  },
  { _id: true },
);

const automationSchema = new mongoose.Schema(
  {
    workspaceId: { type: mongoose.Schema.Types.ObjectId, ref: 'Workspace', required: true },
    name: { type: String, required: true },
    enabled: { type: Boolean, default: true },
    trigger: {
      event: { type: String, required: true }, // 'record.created' | 'record.updated'
      objectSlug: { type: String, required: true },
    },
    conditions: { type: [conditionSchema], default: [] },
    actions: { type: [actionSchema], default: [] },
    runLog: { type: [runSchema], default: [] },
    // Las evaluaciones que no casaron van a un contador y **no** al `runLog`: una
    // regla estrecha se evalúa en cada registro creado, y empujarlas al log
    // expulsaría en minutos las ejecuciones de verdad de la ventana de 20. El
    // contador responde igual a la pregunta que se hace uno mirando la lista
    // («¿se está evaluando siquiera?») y cuesta un `$inc` en vez de un `$push`.
    skippedCount: { type: Number, default: 0 },
    lastSkippedAt: { type: Date, default: null },
  },
  { timestamps: true },
);

// El motor busca por (workspace, activas, evento, objeto) en cada evento.
automationSchema.index({
  workspaceId: 1,
  enabled: 1,
  'trigger.event': 1,
  'trigger.objectSlug': 1,
});

export const Automation =
  mongoose.models.Automation || mongoose.model('Automation', automationSchema);
export default Automation;
