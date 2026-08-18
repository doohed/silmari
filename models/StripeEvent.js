import mongoose from 'mongoose';

/**
 * Registro de eventos de Stripe ya procesados, para **idempotencia**.
 *
 * Stripe reintenta la entrega de un webhook hasta que responde 2xx, y puede
 * entregar el mismo evento más de una vez aunque respondas bien. Sin este
 * registro, un reintento podría reaplicar un cambio de plan o duplicar efectos.
 *
 * El `_id` es el `event.id` de Stripe: la propia clave primaria hace de guardia
 * (un segundo insert falla con error de duplicado).
 *
 * @typedef {object} StripeEventDoc
 * @property {string} _id  El `event.id` de Stripe (evt_...)
 * @property {string} type
 */

const stripeEventSchema = new mongoose.Schema(
  {
    _id: { type: String, required: true },
    type: { type: String, required: true },
    processedAt: { type: Date, default: Date.now },
  },
  { _id: false, timestamps: false },
);

// Los eventos viejos no aportan nada: se purgan solos a los 30 días. El margen
// es muy superior a la ventana de reintentos de Stripe (72 h).
stripeEventSchema.index({ processedAt: 1 }, { expireAfterSeconds: 30 * 24 * 60 * 60 });

export const StripeEvent =
  mongoose.models.StripeEvent || mongoose.model('StripeEvent', stripeEventSchema);
export default StripeEvent;
