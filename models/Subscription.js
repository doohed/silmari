import mongoose from 'mongoose';

/**
 * Suscripción de un workspace. Es el **espejo local** de lo que dice Stripe: se
 * actualiza desde el webhook, nunca a mano desde la UI.
 *
 * Un workspace sin documento aquí está en el plan por defecto (Gratis); no se
 * crea un registro hasta que hay un primer pago, para no llenar la colección de
 * filas vacías.
 *
 * @typedef {object} SubscriptionDoc
 * @property {import('mongoose').Types.ObjectId} workspaceId
 * @property {'FREE'|'PRO'|'BUSINESS'} plan
 * @property {string} status  Estado tal cual lo manda Stripe (active, past_due…)
 * @property {string} [stripeCustomerId]
 * @property {string} [stripeSubscriptionId]
 * @property {Date} [currentPeriodEnd]
 * @property {boolean} cancelAtPeriodEnd
 */

const subscriptionSchema = new mongoose.Schema(
  {
    workspaceId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Workspace',
      required: true,
      unique: true,
    },
    plan: { type: String, enum: ['FREE', 'PRO', 'BUSINESS'], default: 'FREE' },
    status: { type: String, default: 'incomplete' },
    stripeCustomerId: { type: String, default: null, index: true },
    stripeSubscriptionId: { type: String, default: null },
    currentPeriodEnd: { type: Date, default: null },
    cancelAtPeriodEnd: { type: Boolean, default: false },
  },
  { timestamps: true },
);

export const Subscription =
  mongoose.models.Subscription || mongoose.model('Subscription', subscriptionSchema);
export default Subscription;
