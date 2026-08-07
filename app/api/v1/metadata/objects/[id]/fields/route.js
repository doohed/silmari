import { authenticateApiRequest } from '@/lib/http/api-context';
import { listFields } from '@/lib/metadata/field-service';
import { errorResponse } from '@/lib/errors/to-response';

export const dynamic = 'force-dynamic';

/** GET /api/v1/metadata/objects/:id/fields — lista los campos de un objeto. */
export async function GET(request, ctxParam) {
  try {
    const { id } = await ctxParam.params;
    const ctx = await authenticateApiRequest(request, 'records:read');
    const fields = await listFields(ctx, id);
    return Response.json({ data: fields });
  } catch (err) {
    return errorResponse(err);
  }
}
