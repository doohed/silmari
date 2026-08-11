/**
 * Autorización basada en roles. `can(ctx, action, resource)` es la única fuente
 * de verdad de permisos; los servicios y acciones la consultan antes de mutar.
 *
 * Este módulo es puro (sin acceso a BD) para poder testearlo de forma aislada.
 */

/** @typedef {'OWNER'|'ADMIN'|'MEMBER'} Role */
/** @typedef {{ userId: string, workspaceId: string, role: Role }} Ctx */

export const ROLES = /** @type {const} */ (['OWNER', 'ADMIN', 'MEMBER']);

// Jerarquía: OWNER incluye lo de ADMIN, que incluye lo de MEMBER.
const RANK = { MEMBER: 1, ADMIN: 2, OWNER: 3 };

/**
 * Rol mínimo requerido por acción. Se irá ampliando en fases posteriores.
 * `records:*` cubre la futura capa de registros (todos los miembros pueden).
 * @type {Record<string, Role>}
 */
const REQUIRED = {
  'members:read': 'MEMBER',
  'members:invite': 'ADMIN',
  'members:remove': 'ADMIN',
  'members:changeRole': 'OWNER',
  'workspace:read': 'MEMBER',
  'workspace:update': 'ADMIN',
  'workspace:delete': 'OWNER',
  'dataModel:read': 'MEMBER',
  'dataModel:manage': 'ADMIN',
  'apiKeys:manage': 'ADMIN',
  'webhooks:manage': 'ADMIN',
  'leadIntakes:manage': 'ADMIN',
  'automations:manage': 'ADMIN',
  'templates:manage': 'ADMIN',
  'forms:manage': 'ADMIN',
  'integrations:manage': 'ADMIN',
};

/**
 * ¿Puede `ctx` ejecutar `action`?
 * @param {Ctx | null | undefined} ctx
 * @param {string} action Clave `recurso:accion`, p. ej. 'members:invite'.
 * @returns {boolean}
 */
export function can(ctx, action) {
  if (!ctx || !ctx.role) return false;
  const required = REQUIRED[action];
  if (!required) return false; // acción desconocida → denegar por defecto
  return (RANK[ctx.role] ?? 0) >= RANK[required];
}
