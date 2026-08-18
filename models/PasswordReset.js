import mongoose from 'mongoose';

/**
 * Token de restablecimiento de contraseña.
 *
 * En BD solo vive el **hash** del token (sha256): quien lea la colección no
 * puede secuestrar una cuenta. El token en claro solo existe en el enlace del
 * correo.
 *
 * @typedef {object} PasswordResetDoc
 * @property {import('mongoose').Types.ObjectId} userId
 * @property {string} tokenHash
 * @property {Date} expiresAt
 * @property {Date} [usedAt]  Sellado al consumirlo: un token vale una sola vez.
 */

const passwordResetSchema = new mongoose.Schema(
  {
    userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    tokenHash: { type: String, required: true, unique: true },
    expiresAt: { type: Date, required: true },
    usedAt: { type: Date, default: null },
    // Solo para auditoría: desde dónde se pidió. Nunca se muestra al usuario.
    requestedFromIp: { type: String, default: null },
  },
  { timestamps: true },
);

// TTL: MongoDB borra el documento al vencer, sin tarea de limpieza propia.
// El servicio comprueba `expiresAt` igualmente, porque el barrido del TTL corre
// cada 60 s y un token podría sobrevivir un minuto de más.
passwordResetSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });

export const PasswordReset =
  mongoose.models.PasswordReset || mongoose.model('PasswordReset', passwordResetSchema);
export default PasswordReset;
