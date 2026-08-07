import { UnauthorizedError } from '@/lib/errors/domain-errors';

/**
 * Guardia de multi-tenancy: garantiza que todo servicio recibe un contexto con
 * `workspaceId`. Llamar a esto al principio de cada servicio evita fugas por un
 * `ctx` mal formado y hace que las consultas sin `workspaceId` fallen en vez de
 * devolver datos de otro tenant.
 * @param {import('@/lib/auth/permissions').Ctx | null | undefined} ctx
 * @returns {import('@/lib/auth/permissions').Ctx}
 */
export function assertTenant(ctx) {
  if (!ctx || !ctx.workspaceId || !ctx.userId) {
    throw new UnauthorizedError('Contexto de tenant no válido');
  }
  return ctx;
}
