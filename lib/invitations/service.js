import mongoose from 'mongoose';
import { randomBytes, createHash } from 'node:crypto';
import { connectToDatabase } from '@/lib/db/connect';
import { hashPassword } from '@/lib/auth/password';
import { can } from '@/lib/auth/permissions';
import { assertTenant } from '@/lib/services/tenant';
import { appUrl, appName } from '@/lib/config/app';
import { assertEmailVerified } from '@/lib/accounts/email-verification';
import { assertWithinPlan } from '@/lib/billing/limits';
import { sendSystemEmail } from '@/lib/mailer';
import { invitationEmail } from '@/lib/mailer/templates';
import { logger } from '@/lib/utils/logger';
import {
  ConflictError,
  ForbiddenError,
  NotFoundError,
  ValidationError,
} from '@/lib/errors/domain-errors';
import User from '@/models/User';
import Workspace from '@/models/Workspace';
import WorkspaceMember from '@/models/WorkspaceMember';
import Invitation from '@/models/Invitation';

const INVITE_TTL_MS = 7 * 24 * 60 * 60 * 1000; // 7 días

/** @param {string} raw @returns {string} */
function hashToken(raw) {
  return createHash('sha256').update(raw).digest('hex');
}

/**
 * Envía el correo de invitación. **Nunca lanza**: si el correo falla, la
 * invitación ya está creada y quien invita todavía puede copiar el enlace desde
 * la UI. El fallo queda en el log.
 *
 * La URL se construye aquí en vez de reusar `inviteUrl` de `lib/onboarding`
 * porque ese módulo ya importa este: reutilizarla crearía un ciclo.
 *
 * @param {import('@/lib/auth/permissions').Ctx} ctx
 * @param {{ email: string, rawToken: string }} args
 */
async function deliverInvitationEmail(ctx, { email, rawToken }) {
  try {
    const [workspace, inviter] = await Promise.all([
      Workspace.findById(ctx.workspaceId).select('name').lean(),
      User.findById(ctx.userId).select('firstName lastName').lean(),
    ]);

    const inviterName = [inviter?.firstName, inviter?.lastName].filter(Boolean).join(' ').trim();
    const { subject, html, text } = invitationEmail({
      appName: appName(),
      url: `${appUrl()}/invite/${rawToken}`,
      workspaceName: workspace?.name ?? appName(),
      inviterName: inviterName || undefined,
      expiresInDays: Math.round(INVITE_TTL_MS / 86400000),
    });

    await sendSystemEmail({ to: email, subject, html, text });
  } catch (err) {
    logger.error('No se pudo enviar la invitación por correo', {
      email,
      message: err?.message,
    });
  }
}

/**
 * Crea una invitación pendiente y devuelve el token EN CLARO (solo se ve aquí,
 * para construir el enlace). En BD se guarda su hash.
 * @param {import('@/lib/auth/permissions').Ctx} ctx
 * @param {{ email: string, role: 'ADMIN'|'MEMBER' }} input
 * @param {{ requireVerifiedEmail?: boolean }} [opts]
 * @returns {Promise<{ token: string, invitationId: string }>}
 */
export async function createInvitation(ctx, { email, role }, { requireVerifiedEmail = true } = {}) {
  assertTenant(ctx);
  if (!can(ctx, 'members:invite')) {
    throw new ForbiddenError('No tienes permiso para invitar miembros');
  }
  // Invitar manda correo desde tu dominio: por defecto, no desde cuentas sin
  // confirmar. La única excepción es el paso del onboarding (ver
  // `saveInviteStep`), que ocurre segundos después del alta —cuando nadie ha
  // clicado aún el enlace— y ya está acotado a 3 direcciones.
  if (requireVerifiedEmail) await assertEmailVerified(ctx);
  // El tope de miembros del plan cuenta también las invitaciones que se aceptarán.
  await assertWithinPlan(ctx, 'members');
  await connectToDatabase();

  // ¿Ya es miembro? (existe usuario con ese email y pertenece al workspace)
  const existingUser = await User.findOne({ email }).select('_id').lean();
  if (existingUser) {
    const already = await WorkspaceMember.findOne({
      workspaceId: ctx.workspaceId,
      userId: existingUser._id,
    })
      .select('_id')
      .lean();
    if (already) {
      throw new ConflictError('Esa persona ya es miembro del espacio de trabajo', {
        fieldErrors: { email: ['Ya es miembro'] },
      });
    }
  }

  const raw = randomBytes(32).toString('base64url');
  const token = hashToken(raw);
  const expiresAt = new Date(Date.now() + INVITE_TTL_MS);

  try {
    const invitation = await Invitation.create({
      workspaceId: ctx.workspaceId,
      email,
      role,
      token,
      expiresAt,
      invitedBy: ctx.userId,
    });
    await deliverInvitationEmail(ctx, { email, rawToken: raw });
    return { token: raw, invitationId: String(invitation._id) };
  } catch (err) {
    if (err?.code === 11000) {
      throw new ConflictError('Ya hay una invitación pendiente para ese email', {
        fieldErrors: { email: ['Invitación ya enviada'] },
      });
    }
    throw err;
  }
}

/**
 * Recupera una invitación pendiente por su token en claro, con datos para la
 * página de aceptación. Lanza si no existe, ya se aceptó o expiró.
 * @param {string} rawToken
 * @returns {Promise<{ email: string, role: string, workspaceName: string, isExistingUser: boolean }>}
 */
export async function getInvitationByToken(rawToken) {
  if (!rawToken) throw new NotFoundError('Invitación no encontrada');
  await connectToDatabase();

  const invitation = await Invitation.findOne({ token: hashToken(rawToken) }).lean();
  if (!invitation) throw new NotFoundError('Invitación no encontrada');
  if (invitation.acceptedAt) throw new ConflictError('Esta invitación ya se usó');
  if (invitation.expiresAt < new Date()) throw new ValidationError('Esta invitación ha caducado');

  const workspace = await Workspace.findById(invitation.workspaceId).select('name').lean();
  const existingUser = await User.findOne({ email: invitation.email }).select('_id').lean();

  return {
    email: invitation.email,
    role: invitation.role,
    workspaceName: workspace?.name ?? 'Espacio de trabajo',
    isExistingUser: Boolean(existingUser),
  };
}

/**
 * Acepta una invitación. Si el email ya tiene cuenta, la vincula como miembro
 * (el token del email autoriza). Si no, crea la cuenta con los datos del
 * formulario. Todo en una transacción. Devuelve el contexto para iniciar sesión.
 * @param {{ token: string, firstName?: string, lastName?: string, password?: string }} input
 * @returns {Promise<{ userId: string, workspaceId: string }>}
 */
export async function acceptInvitation({ token, firstName, lastName, password }) {
  await connectToDatabase();
  const tokenHash = hashToken(token);

  const invitation = await Invitation.findOne({ token: tokenHash });
  if (!invitation) throw new NotFoundError('Invitación no encontrada');
  if (invitation.acceptedAt) throw new ConflictError('Esta invitación ya se usó');
  if (invitation.expiresAt < new Date()) throw new ValidationError('Esta invitación ha caducado');

  const existingUser = await User.findOne({ email: invitation.email }).select('_id');
  if (!existingUser && (!firstName || !password)) {
    throw new ValidationError('Faltan datos para crear la cuenta');
  }

  const session = await mongoose.startSession();
  try {
    let userId;
    await session.withTransaction(async () => {
      // Re-lee la invitación dentro de la transacción y bloquea el doble uso.
      const fresh = await Invitation.findOneAndUpdate(
        { _id: invitation._id, acceptedAt: null },
        { $set: { acceptedAt: new Date() } },
        { session, returnDocument: 'after' },
      );
      if (!fresh) throw new ConflictError('Esta invitación ya se usó');

      let uid = existingUser?._id;
      if (!uid) {
        const passwordHash = await hashPassword(password);
        const [user] = await User.create(
          [
            {
              firstName,
              lastName: lastName ?? '',
              email: invitation.email,
              passwordHash,
              // Ha llegado hasta aquí con un token que solo estaba en ese buzón:
              // la dirección queda demostrada, no hace falta confirmarla otra vez.
              emailVerifiedAt: new Date(),
            },
          ],
          { session },
        );
        uid = user._id;
      } else {
        // Mismo razonamiento para una cuenta que existía sin confirmar.
        await User.updateOne(
          { _id: uid, emailVerifiedAt: null },
          { $set: { emailVerifiedAt: new Date() } },
          { session },
        );
      }

      await WorkspaceMember.create(
        [
          {
            workspaceId: fresh.workspaceId,
            userId: uid,
            role: fresh.role,
            invitedBy: fresh.invitedBy,
            joinedAt: new Date(),
          },
        ],
        { session },
      );
      userId = String(uid);
    });

    return { userId, workspaceId: String(invitation.workspaceId) };
  } catch (err) {
    if (err?.code === 11000) {
      // Ya era miembro (carrera): tratamos como conflicto claro.
      throw new ConflictError('Ya eres miembro de este espacio de trabajo');
    }
    throw err;
  } finally {
    await session.endSession();
  }
}
