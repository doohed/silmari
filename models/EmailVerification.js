import mongoose from 'mongoose';

/**
 * Token de verificación de email. Mismo diseño que `PasswordReset`: en BD solo
 * el hash, un solo uso, y TTL que deja que MongoDB limpie los caducados.
 *
 * Se separa de `PasswordReset` a propósito aunque la forma sea parecida: son
 * ciclos de vida distintos (uno caduca en 1 h, este en 3 días) y mezclarlos
 * obligaría a discriminar por un campo `type` en cada consulta.
 *
 * @typedef {object} EmailVerificationDoc
 * @property {import('mongoose').Types.ObjectId} userId
 * @property {string} email  El email verificado; si el usuario lo cambia, el token deja de valer.
 * @property {string} tokenHash
 * @property {Date} expiresAt
 * @property {Date} [usedAt]
 */

const emailVerificationSchema = new mongoose.Schema(
  {
    userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    email: { type: String, required: true, lowercase: true, trim: true },
    tokenHash: { type: String, required: true, unique: true },
    expiresAt: { type: Date, required: true },
    usedAt: { type: Date, default: null },
  },
  { timestamps: true },
);

emailVerificationSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });

export const EmailVerification =
  mongoose.models.EmailVerification || mongoose.model('EmailVerification', emailVerificationSchema);
export default EmailVerification;
