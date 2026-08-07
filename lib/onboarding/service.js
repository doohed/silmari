import { connectToDatabase } from '@/lib/db/connect';
import { assertTenant } from '@/lib/services/tenant';
import { createInvitation } from '@/lib/invitations/service';
import { appUrl, appDomain } from '@/lib/config/app';
import { ConflictError, NotFoundError } from '@/lib/errors/domain-errors';
import { logger } from '@/lib/utils/logger';
import User from '@/models/User';
import Workspace from '@/models/Workspace';
import WorkspaceMember from '@/models/WorkspaceMember';
import Invitation from '@/models/Invitation';

/** @typedef {import('@/lib/auth/permissions').Ctx} Ctx */

/**
 * Estado actual del onboarding para pintar el paso correspondiente.
 * @param {Ctx} ctx
 */
export async function getOnboardingState(ctx) {
  assertTenant(ctx);
  await connectToDatabase();

  const [user, workspace, membersCount, pendingInvites] = await Promise.all([
    User.findById(ctx.userId).select('firstName lastName avatarUrl onboardingStep').lean(),
    Workspace.findById(ctx.workspaceId).select('name slug logoUrl').lean(),
    WorkspaceMember.countDocuments({ workspaceId: ctx.workspaceId }),
    Invitation.find({ workspaceId: ctx.workspaceId, acceptedAt: null }).select('email').lean(),
  ]);
  if (!user || !workspace) throw new NotFoundError('Cuenta no encontrada');

  const member = await WorkspaceMember.findOne({
    workspaceId: ctx.workspaceId,
    userId: ctx.userId,
  })
    .select('jobTitle')
    .lean();

  return {
    step: user.onboardingStep,
    user: {
      firstName: user.firstName,
      lastName: user.lastName ?? '',
      avatarUrl: user.avatarUrl ?? null,
      jobTitle: member?.jobTitle ?? '',
    },
    workspace: {
      name: workspace.name,
      slug: workspace.slug,
      logoUrl: workspace.logoUrl ?? null,
    },
    membersCount,
    invitedEmails: pendingInvites.map((i) => i.email),
    appDomain: appDomain(),
  };
}

/** Avanza el paso del onboarding (sin retroceder). */
async function setStep(userId, step) {
  await User.updateOne({ _id: userId }, { $set: { onboardingStep: step } });
}

/**
 * Paso 1 — Crear workspace: nombre, subdominio (slug) y logo.
 * @param {Ctx} ctx
 * @param {{ name: string, subdomain: string, logoUrl?: string }} input
 */
export async function saveWorkspaceStep(ctx, { name, subdomain, logoUrl }) {
  assertTenant(ctx);
  await connectToDatabase();

  const clash = await Workspace.findOne({ slug: subdomain, _id: { $ne: ctx.workspaceId } })
    .select('_id')
    .lean();
  if (clash) {
    throw new ConflictError('Ese subdominio ya está en uso', {
      fieldErrors: { subdomain: ['Ese subdominio ya está en uso'] },
    });
  }

  const ws = await Workspace.findById(ctx.workspaceId);
  if (!ws) throw new NotFoundError('Espacio de trabajo no encontrado');
  ws.name = name;
  ws.slug = subdomain;
  if (logoUrl !== undefined) ws.logoUrl = logoUrl || null;
  try {
    await ws.save();
  } catch (err) {
    if (err?.code === 11000) {
      throw new ConflictError('Ese subdominio ya está en uso', {
        fieldErrors: { subdomain: ['Ese subdominio ya está en uso'] },
      });
    }
    throw err;
  }

  await setStep(ctx.userId, 'PROFILE');
}

/**
 * Paso 2 — Perfil: nombre, puesto y avatar del usuario.
 * @param {Ctx} ctx
 * @param {{ firstName: string, lastName?: string, jobTitle?: string, avatarUrl?: string }} input
 */
export async function saveProfileStep(ctx, { firstName, lastName = '', jobTitle = '', avatarUrl }) {
  assertTenant(ctx);
  await connectToDatabase();

  const set = { firstName, lastName };
  if (avatarUrl !== undefined) set.avatarUrl = avatarUrl || null;
  await User.updateOne({ _id: ctx.userId }, { $set: set });
  await WorkspaceMember.updateOne(
    { workspaceId: ctx.workspaceId, userId: ctx.userId },
    { $set: { jobTitle } },
  );

  await setStep(ctx.userId, 'INVITE');
}

/**
 * Paso 3 — Invitar equipo. Crea invitaciones y devuelve sus enlaces. Ignora
 * conflictos leves (email ya invitado o ya miembro) para no bloquear el alta.
 * @param {Ctx} ctx
 * @param {{ emails: string[] }} input
 * @returns {Promise<{ invites: Array<{ email: string, url: string }>, skipped: string[] }>}
 */
export async function saveInviteStep(ctx, { emails }) {
  assertTenant(ctx);
  await connectToDatabase();

  const unique = [...new Set(emails.filter(Boolean))].slice(0, 3);
  const invites = [];
  const skipped = [];
  for (const email of unique) {
    try {
      const { token } = await createInvitation(ctx, { email, role: 'MEMBER' });
      invites.push({ email, url: inviteUrl(token) });
    } catch (err) {
      if (err instanceof ConflictError) {
        skipped.push(email);
      } else {
        throw err;
      }
    }
  }
  logger.info('Onboarding: invitaciones', {
    workspaceId: ctx.workspaceId,
    sent: invites.length,
    skipped: skipped.length,
  });

  await setStep(ctx.userId, 'PLAN');
  return { invites, skipped };
}

/** Salta el paso de invitaciones. */
export async function skipInviteStep(ctx) {
  assertTenant(ctx);
  await connectToDatabase();
  await setStep(ctx.userId, 'PLAN');
}

/**
 * Paso 4 — Plan (solo visual, sin pago). Avanza a la animación de bienvenida.
 * La integración real con Stripe vive detrás de `lib/billing/` (Fase 13).
 * @param {Ctx} ctx
 */
export async function completePlanStep(ctx) {
  assertTenant(ctx);
  await connectToDatabase();
  await setStep(ctx.userId, 'WELCOME');
}

/** Paso 5 — Cierra el onboarding: la cuenta entra a la app. */
export async function finishOnboarding(ctx) {
  assertTenant(ctx);
  await connectToDatabase();
  await setStep(ctx.userId, 'DONE');
}

/** Construye el enlace de aceptación de invitación a partir del token en claro. */
export function inviteUrl(rawToken) {
  return `${appUrl()}/invite/${rawToken}`;
}
