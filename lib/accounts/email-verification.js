import { randomBytes, createHash } from 'node:crypto';
import { connectToDatabase } from '@/lib/db/connect';
import { appUrl, appName } from '@/lib/config/app';
import { sendSystemEmail } from '@/lib/mailer';
import { emailVerificationEmail } from '@/lib/mailer/templates';
import { ForbiddenError, ValidationError } from '@/lib/errors/domain-errors';
import { logger } from '@/lib/utils/logger';
import EmailVerification from '@/models/EmailVerification';
import User from '@/models/User';

/** Margen amplio: no es un token sensible, es una confirmación de buzón. */
const TTL_MS = 3 * 24 * 60 * 60 * 1000; // 3 días
const EXPIRES_IN_DAYS = TTL_MS / 86400000;

/** Reenvíos: uno cada minuto como mucho, para no convertirlo en un cañón de spam. */
const RESEND_COOLDOWN_MS = 60 * 1000;

/** @param {string} raw @returns {string} */
function hashToken(raw) {
  return createHash('sha256').update(raw).digest('hex');
}

/**
 * Emite un token y manda el correo de verificación. Invalida los pendientes: si
 * pides el enlace dos veces, solo vale el último.
 *
 * No lanza si el correo falla (`sendSystemEmail` ya lo absorbe): la cuenta se ha
 * creado igual y el usuario puede pedir el reenvío.
 *
 * @param {{ userId: string, email: string }} args
 */
export async function sendEmailVerification({ userId, email }) {
  await connectToDatabase();

  await EmailVerification.updateMany({ userId, usedAt: null }, { $set: { usedAt: new Date() } });

  const raw = randomBytes(32).toString('base64url');
  await EmailVerification.create({
    userId,
    email,
    tokenHash: hashToken(raw),
    expiresAt: new Date(Date.now() + TTL_MS),
  });

  const { subject, html, text } = emailVerificationEmail({
    appName: appName(),
    url: `${appUrl()}/verify/${raw}`,
    expiresInDays: EXPIRES_IN_DAYS,
  });

  await sendSystemEmail({ to: email, subject, html, text });
}

/**
 * Consume el token y marca el email como verificado.
 *
 * Si el usuario cambió de dirección después de pedir el enlace, el token deja de
 * servir: verificaría un buzón que ya no es el de la cuenta.
 *
 * @param {string} rawToken
 * @returns {Promise<{ email: string }>}
 */
export async function verifyEmailToken(rawToken) {
  if (!rawToken) throw new ValidationError('Enlace no válido');
  await connectToDatabase();

  const doc = await EmailVerification.findOne({ tokenHash: hashToken(rawToken), usedAt: null });
  if (!doc || doc.expiresAt <= new Date()) {
    throw new ValidationError('El enlace no es válido o ha caducado. Pide uno nuevo.');
  }

  const user = await User.findOne({ _id: doc.userId, deletedAt: null });
  if (!user) throw new ValidationError('El enlace no es válido o ha caducado. Pide uno nuevo.');
  if (user.email !== doc.email) {
    throw new ValidationError('Este enlace era para otra dirección. Pide uno nuevo.');
  }

  if (!user.emailVerifiedAt) {
    user.emailVerifiedAt = new Date();
    await user.save();
  }

  doc.usedAt = new Date();
  await doc.save();

  logger.info('Email verificado', { userId: String(user._id) });
  return { email: user.email };
}

/**
 * Reenvía el correo al usuario de la sesión. Con enfriamiento para que el botón
 * no se pueda usar como amplificador.
 * @param {import('@/lib/auth/permissions').Ctx} ctx
 * @returns {Promise<{ sent: boolean }>}
 */
export async function resendEmailVerification(ctx) {
  await connectToDatabase();
  const user = await User.findById(ctx.userId).select('email emailVerifiedAt').lean();
  if (!user) throw new ValidationError('Usuario no encontrado');
  if (user.emailVerifiedAt) return { sent: false };

  const last = await EmailVerification.findOne({ userId: ctx.userId })
    .sort({ createdAt: -1 })
    .select('createdAt')
    .lean();
  if (last && Date.now() - new Date(last.createdAt).getTime() < RESEND_COOLDOWN_MS) {
    throw new ValidationError('Acabamos de enviarte un correo. Espera un minuto antes de repetir.');
  }

  await sendEmailVerification({ userId: String(ctx.userId), email: user.email });
  return { sent: true };
}

/** ¿Está verificado el email del usuario actual? */
export async function isEmailVerified(ctx) {
  await connectToDatabase();
  const user = await User.findById(ctx.userId).select('emailVerifiedAt').lean();
  return Boolean(user?.emailVerifiedAt);
}

/**
 * Guarda para las acciones que no deben poder ejecutarse desde una cuenta sin
 * confirmar: invitar gente, crear API keys y crear webhooks. Todas ellas usan
 * la reputación de tu dominio o abren una salida de datos, y son justo lo que
 * busca quien se registra con un email que no es suyo.
 *
 * Se consulta en BD y no en el `ctx` a propósito: el contexto se deriva del JWT
 * de sesión, que puede haberse emitido antes de verificar.
 *
 * @param {import('@/lib/auth/permissions').Ctx} ctx
 */
export async function assertEmailVerified(ctx) {
  // Las API keys actúan en nombre del workspace, no de una persona: su propio
  // scope ya las limita y no tienen buzón que confirmar.
  if (String(ctx.userId).startsWith('apikey:')) return;

  if (!(await isEmailVerified(ctx))) {
    throw new ForbiddenError('Confirma tu email antes de usar esta función');
  }
}
