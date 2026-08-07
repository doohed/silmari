import { connectToDatabase } from '@/lib/db/connect';
import { assertTenant } from '@/lib/services/tenant';
import { can } from '@/lib/auth/permissions';
import { ForbiddenError, NotFoundError } from '@/lib/errors/domain-errors';
import Workspace from '@/models/Workspace';
import WorkspaceMember from '@/models/WorkspaceMember';

/**
 * Lista los workspaces a los que pertenece un usuario, con su rol.
 * @param {string} userId
 * @returns {Promise<Array<{ id: string, name: string, slug: string, role: string }>>}
 */
export async function listUserWorkspaces(userId) {
  await connectToDatabase();
  const memberships = await WorkspaceMember.find({ userId })
    .populate({ path: 'workspaceId', match: { deletedAt: null }, select: 'name slug' })
    .sort({ joinedAt: 1 })
    .lean();

  return memberships
    .filter((m) => m.workspaceId) // descarta workspaces borrados
    .map((m) => ({
      id: String(m.workspaceId._id),
      name: m.workspaceId.name,
      slug: m.workspaceId.slug,
      role: m.role,
    }));
}

/**
 * Devuelve el rol del usuario en un workspace, o null si no pertenece.
 * Se usa para validar el cambio de workspace (nunca confiar en el cliente).
 * @param {string} userId
 * @param {string} workspaceId
 * @returns {Promise<string | null>}
 */
export async function getMembershipRole(userId, workspaceId) {
  await connectToDatabase();
  const member = await WorkspaceMember.findOne({ userId, workspaceId }).select('role').lean();
  return member?.role ?? null;
}

/**
 * Datos del workspace del contexto actual (siempre filtrado por `ctx.workspaceId`).
 * @param {import('@/lib/auth/permissions').Ctx} ctx
 * @returns {Promise<{ id: string, name: string, slug: string, settings: object }>}
 */
export async function getCurrentWorkspace(ctx) {
  assertTenant(ctx);
  await connectToDatabase();
  const ws = await Workspace.findOne({ _id: ctx.workspaceId, deletedAt: null }).lean();
  if (!ws) throw new NotFoundError('Espacio de trabajo no encontrado');
  return {
    id: String(ws._id),
    name: ws.name,
    slug: ws.slug,
    logoUrl: ws.logoUrl ?? null,
    settings: ws.settings ?? {},
  };
}

/**
 * Actualiza el workspace (nombre, logo, ajustes). Requiere rol ADMIN.
 * @param {import('@/lib/auth/permissions').Ctx} ctx
 * @param {{ name?: string, logoUrl?: string, settings?: object }} patch
 */
export async function updateWorkspace(ctx, patch) {
  assertTenant(ctx);
  if (!can(ctx, 'workspace:update'))
    throw new ForbiddenError('No puedes editar el espacio de trabajo');
  await connectToDatabase();
  const ws = await Workspace.findOne({ _id: ctx.workspaceId, deletedAt: null });
  if (!ws) throw new NotFoundError('Espacio de trabajo no encontrado');

  if (patch.name !== undefined) ws.name = patch.name;
  if (patch.logoUrl !== undefined) ws.logoUrl = patch.logoUrl;
  if (patch.settings) {
    for (const k of ['theme', 'currency', 'timezone']) {
      if (patch.settings[k] !== undefined) ws.settings[k] = patch.settings[k];
    }
  }
  await ws.save();
  return getCurrentWorkspace(ctx);
}
