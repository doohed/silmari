import { randomBytes, createHash } from 'node:crypto';
import { connectToDatabase } from '@/lib/db/connect';
import { hashPassword } from '@/lib/auth/password';
import { appUrl, appName } from '@/lib/config/app';
import { sendSystemEmail } from '@/lib/mailer';
import { passwordResetEmail } from '@/lib/mailer/templates';
import { ValidationError } from '@/lib/errors/domain-errors';
import { logSecurityEvent } from '@/lib/utils/logger';
import PasswordReset from '@/models/PasswordReset';
import User from '@/models/User';

/** Validez del enlace. Corta a propósito: es un correo, no una sesión. */
const TTL_MS = 60 * 60 * 1000; // 1 hora
const EXPIRES_IN_MINUTES = TTL_MS / 60000;

/** @param {string} raw @returns {string} */
function hashToken(raw) {
  return createHash('sha256').update(raw).digest('hex');
}

/**
 * Solicita el restablecimiento de contraseña.
 *
 * **Siempre resuelve igual**, exista la cuenta o no: si dijéramos "ese email no
 * está registrado" convertiríamos este formulario en un detector de cuentas.
 * Por eso no devuelve nada útil y no lanza cuando el usuario no existe.
 *
 * Una cuenta creada con Google o Microsoft también puede pedirlo: establecer
 * una contraseña es una forma legítima de añadir un segundo modo de entrar.
 *
 * @param {{ email: string, ip?: string|null }} input
 * @returns {Promise<void>}
 */
export async function requestPasswordReset({ email, ip = null }) {
  await connectToDatabase();

  const user = await User.findOne({ email, deletedAt: null }).select('_id email').lean();
  if (!user) {
    logSecurityEvent('password.reset.requested', { email, found: false, ip });
    return;
  }

  // Un token nuevo invalida los pendientes: si pides el enlace dos veces, solo
  // vale el último que te ha llegado.
  await PasswordReset.updateMany(
    { userId: user._id, usedAt: null },
    { $set: { usedAt: new Date() } },
  );

  const raw = randomBytes(32).toString('base64url');
  await PasswordReset.create({
    userId: user._id,
    tokenHash: hashToken(raw),
    expiresAt: new Date(Date.now() + TTL_MS),
    requestedFromIp: ip,
  });

  const { subject, html, text } = passwordResetEmail({
    appName: appName(),
    url: `${appUrl()}/reset/${raw}`,
    expiresInMinutes: EXPIRES_IN_MINUTES,
  });

  // Si el correo falla no se lo decimos al usuario (delataría que la cuenta
  // existe); queda en el log para poder diagnosticarlo.
  logSecurityEvent('password.reset.requested', { email, found: true, ip });
  await sendSystemEmail({ to: user.email, subject, html, text });
}

/**
 * ¿El token es utilizable? Para pintar la página de reset sin gastarlo.
 * @param {string} rawToken
 * @returns {Promise<boolean>}
 */
export async function isResetTokenValid(rawToken) {
  if (!rawToken) return false;
  await connectToDatabase();
  const doc = await PasswordReset.findOne({ tokenHash: hashToken(rawToken), usedAt: null })
    .select('expiresAt')
    .lean();
  return Boolean(doc && doc.expiresAt > new Date());
}

/**
 * Consume el token y establece la contraseña nueva.
 *
 * No inicia sesión: al terminar se manda al login. Quien controle el buzón ya ha
 * demostrado bastante; crear una sesión desde un enlace de correo es un paso más
 * que no hace falta dar.
 *
 * @param {{ token: string, password: string }} input
 * @returns {Promise<{ email: string }>}
 */
export async function resetPassword({ token, password }) {
  await connectToDatabase();

  const doc = await PasswordReset.findOne({ tokenHash: hashToken(token), usedAt: null });
  if (!doc || doc.expiresAt <= new Date()) {
    throw new ValidationError('El enlace no es válido o ha caducado. Pide uno nuevo.');
  }

  const user = await User.findOne({ _id: doc.userId, deletedAt: null });
  if (!user) {
    throw new ValidationError('El enlace no es válido o ha caducado. Pide uno nuevo.');
  }

  user.passwordHash = await hashPassword(password);
  // El enlace se usa justo cuando alguien ha perdido el control de la cuenta:
  // las sesiones abiertas (las suyas y las del que se la tomara) se cortan aquí.
  // No hay cookie que re-emitir, este flujo termina mandando al login.
  user.sessionsValidFrom = new Date();
  await user.save();

  doc.usedAt = new Date();
  await doc.save();

  // Cualquier otro enlace pendiente de esta cuenta queda inservible.
  await PasswordReset.updateMany(
    { userId: user._id, usedAt: null },
    { $set: { usedAt: new Date() } },
  );

  logSecurityEvent('password.changed', { userId: String(user._id), source: 'reset-link' });
  return { email: user.email };
}

/**
 * Invalida los enlaces pendientes de un usuario. Se llama al cambiar la
 * contraseña desde Ajustes: si alguien había pedido un enlace, deja de servir.
 * @param {string} userId
 */
export async function invalidatePendingResets(userId) {
  await connectToDatabase();
  await PasswordReset.updateMany({ userId, usedAt: null }, { $set: { usedAt: new Date() } });
}
