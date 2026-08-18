import { authenticateApiRequest } from '@/lib/http/api-context';
import { ingestLead } from '@/lib/leads/service';
import { errorResponse } from '@/lib/errors/to-response';

export const dynamic = 'force-dynamic';

/**
 * POST /api/v1/intake/meta — recibe un lead de Meta Lead Ads (Facebook e
 * Instagram) reenviado por Zapier/Make y lo convierte en un registro según la
 * configuración de Ajustes → Entrada de leads.
 *
 * Acepta el lead tal cual lo entrega Meta (`field_data`) o ya aplanado. La
 * configuración se elige por `form_id`; si el formulario no tiene una propia,
 * se usa la comodín.
 */
export async function POST(request) {
  try {
    const ctx = await authenticateApiRequest(request, 'records:write');
    const body = await request.json().catch(() => ({}));
    const result = await ingestLead(ctx, body);
    return Response.json({ data: result }, { status: result.action === 'created' ? 201 : 200 });
  } catch (err) {
    return errorResponse(err);
  }
}
