import { randomBytes, createHash } from 'node:crypto';
import { connectToDatabase } from '@/lib/db/connect';
import { assertTenant } from '@/lib/services/tenant';
import { can } from '@/lib/auth/permissions';
import { assertEmailVerified } from '@/lib/accounts/email-verification';
import { assertWithinPlan } from '@/lib/billing/limits';
import { ForbiddenError, NotFoundError, UnauthorizedError } from '@/lib/errors/domain-errors';
import ApiKey from '@/models/ApiKey';

/** @param {string} raw @returns {string} */
function hash(raw) {
  return createHash('sha256').update(raw).digest('hex');
}

/**
 * Crea una API key. Devuelve el token EN CLARO una única vez (no se guarda).
 * @param {import('@/lib/auth/permissions').Ctx} ctx
 * @param {{ name: string, scopes?: string[], expiresAt?: Date }} input
 * @returns {Promise<{ token: string, prefix: string, id: string }>}
 */
export async function createApiKey(ctx, { name, scopes, expiresAt } = {}) {
  assertTenant(ctx);
  if (!can(ctx, 'apiKeys:manage')) throw new ForbiddenError('No puedes gestionar las API keys');
  // Una API key es una salida de datos permanente: exige email confirmado.
  await assertEmailVerified(ctx);
  await assertWithinPlan(ctx, 'apiKeys');
  await connectToDatabase();
  const prefix = `sk_${randomBytes(4).toString('hex')}`;
  const secret = randomBytes(24).toString('base64url');
  const token = `${prefix}.${secret}`;

  const doc = await ApiKey.create({
    workspaceId: ctx.workspaceId,
    name: name ?? 'API key',
    tokenHash: hash(token),
    prefix,
    scopes: scopes ?? ['records:read', 'records:write'],
    createdBy: ctx.userId?.startsWith?.('apikey:') ? null : ctx.userId,
    expiresAt: expiresAt ?? null,
  });

  return { token, prefix, id: String(doc._id) };
}

/**
 * Verifica un token de API y devuelve el contexto derivado, o lanza si es
 * inválido/expirado/revocado.
 * @param {string | undefined | null} rawToken
 * @returns {Promise<{ ctx: import('@/lib/auth/permissions').Ctx & { scopes: string[], source: string, actorName: string }, apiKeyId: string }>}
 */
export async function authenticateApiKey(rawToken) {
  if (!rawToken) throw new UnauthorizedError('Falta la API key');
  await connectToDatabase();

  const key = await ApiKey.findOne({ tokenHash: hash(rawToken), revokedAt: null });
  if (!key) throw new UnauthorizedError('API key no válida');
  if (key.expiresAt && key.expiresAt < new Date()) {
    throw new UnauthorizedError('API key expirada');
  }

  key.lastUsedAt = new Date();
  key.save().catch(() => {}); // no bloquea la petición

  const ctx = {
    userId: `apikey:${key._id}`,
    workspaceId: String(key.workspaceId),
    role: 'MEMBER',
    scopes: key.scopes,
    source: 'API',
    actorName: key.name,
  };
  return { ctx, apiKeyId: String(key._id) };
}

/**
 * Exige un scope; lanza ForbiddenError si la key no lo tiene.
 * @param {{ scopes?: string[] }} ctx
 * @param {string} scope
 */
export function requireScope(ctx, scope) {
  if (!ctx.scopes?.includes(scope)) {
    throw new ForbiddenError(`La API key no tiene el permiso "${scope}"`);
  }
}

/** Lista las API keys del workspace (sin el token). */
export async function listApiKeys(ctx) {
  assertTenant(ctx);
  if (!can(ctx, 'apiKeys:manage')) throw new ForbiddenError('No puedes gestionar las API keys');
  await connectToDatabase();
  const keys = await ApiKey.find({ workspaceId: ctx.workspaceId }).sort({ createdAt: -1 }).lean();
  return keys.map((k) => ({
    id: String(k._id),
    name: k.name,
    prefix: k.prefix,
    scopes: k.scopes,
    revokedAt: k.revokedAt ?? null,
    lastUsedAt: k.lastUsedAt ?? null,
    createdAt: k.createdAt,
  }));
}

/** Revoca una API key. */
export async function revokeApiKey(ctx, id) {
  assertTenant(ctx);
  if (!can(ctx, 'apiKeys:manage')) throw new ForbiddenError('No puedes gestionar las API keys');
  await connectToDatabase();
  const key = await ApiKey.findOne({ _id: id, workspaceId: ctx.workspaceId });
  if (!key) throw new NotFoundError('API key no encontrada');
  key.revokedAt = new Date();
  await key.save();
}
