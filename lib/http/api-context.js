import { authenticateApiKey, requireScope } from '@/lib/auth/api-key';
import { consumeRateLimit } from '@/lib/http/rate-limit';

/** Extrae el token del header Authorization: Bearer <token> (o x-api-key). */
function extractToken(request) {
  const auth = request.headers.get('authorization');
  if (auth?.startsWith('Bearer ')) return auth.slice(7).trim();
  return request.headers.get('x-api-key') ?? undefined;
}

/**
 * Autentica una petición de la API pública, aplica rate limit por key y valida
 * el scope. Devuelve el ctx derivado de la key. Lanza errores de dominio.
 * @param {Request} request
 * @param {string} requiredScope  p. ej. 'records:read'
 * @returns {Promise<import('@/lib/auth/permissions').Ctx & { scopes: string[], source: string, actorName: string }>}
 */
export async function authenticateApiRequest(request, requiredScope) {
  const { ctx, apiKeyId } = await authenticateApiKey(extractToken(request));
  consumeRateLimit(`apikey:${apiKeyId}`);
  requireScope(ctx, requiredScope);
  return ctx;
}
