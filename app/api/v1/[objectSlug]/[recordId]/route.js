import { authenticateApiRequest } from '@/lib/http/api-context';
import { getRecord, updateRecord, softDeleteRecord } from '@/lib/records/service';
import { errorResponse } from '@/lib/errors/to-response';

export const dynamic = 'force-dynamic';

/** GET /api/v1/:objectSlug/:recordId */
export async function GET(request, ctxParam) {
  try {
    const { objectSlug, recordId } = await ctxParam.params;
    const ctx = await authenticateApiRequest(request, 'records:read');
    const record = await getRecord(ctx, { objectSlug, recordId });
    return Response.json({ data: record });
  } catch (err) {
    return errorResponse(err);
  }
}

/** PATCH /api/v1/:objectSlug/:recordId */
export async function PATCH(request, ctxParam) {
  try {
    const { objectSlug, recordId } = await ctxParam.params;
    const ctx = await authenticateApiRequest(request, 'records:write');
    const body = await request.json().catch(() => ({}));
    const record = await updateRecord(ctx, { objectSlug, recordId, data: body?.data ?? body });
    return Response.json({ data: record });
  } catch (err) {
    return errorResponse(err);
  }
}

/** DELETE /api/v1/:objectSlug/:recordId — soft delete. */
export async function DELETE(request, ctxParam) {
  try {
    const { objectSlug, recordId } = await ctxParam.params;
    const ctx = await authenticateApiRequest(request, 'records:write');
    await softDeleteRecord(ctx, { objectSlug, recordId });
    return new Response(null, { status: 204 });
  } catch (err) {
    return errorResponse(err);
  }
}
