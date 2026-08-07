import mongoose from 'mongoose';
import { randomBytes, createHash } from 'node:crypto';
import { connectToDatabase } from '@/lib/db/connect';
import { hashPassword } from '@/lib/auth/password';
import { can } from '@/lib/auth/permissions';
import { assertTenant } from '@/lib/services/tenant';
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
 * Crea una invitación pendiente y devuelve el token EN CLARO (solo se ve aquí,
 * para construir el enlace). En BD se guarda su hash.
 * @param {import('@/lib/auth/permissions').Ctx} ctx
 * @param {{ email: string, role: 'ADMIN'|'MEMBER' }} input
 * @returns {Promise<{ token: string, invitationId: string }>}
 */
export async function createInvitation(ctx, { email, role }) {
  assertTenant(ctx);
  if (!can(ctx, 'members:invite')) {
    throw new ForbiddenError('No tienes permiso para invitar miembros');
  }
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
          [{ firstName, lastName: lastName ?? '', email: invitation.email, passwordHash }],
          { session },
        );
        uid = user._id;
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
