import { authenticateApiRequest } from '@/lib/http/api-context';
import { parseListParams } from '@/lib/http/parse-list-params';
import { listRecords, createRecord } from '@/lib/records/service';
import { errorResponse } from '@/lib/errors/to-response';

export const dynamic = 'force-dynamic';

/** GET /api/v1/:objectSlug — lista registros con filtros/orden/paginación. */
export async function GET(request, ctxParam) {
  try {
    const { objectSlug } = await ctxParam.params;
    const ctx = await authenticateApiRequest(request, 'records:read');
    const params = parseListParams(new URL(request.url).searchParams);
    const result = await listRecords(ctx, { objectSlug, ...params });
    return Response.json({ data: result.records, nextCursor: result.nextCursor });
  } catch (err) {
    return errorResponse(err);
  }
}

/** POST /api/v1/:objectSlug — crea un registro. */
export async function POST(request, ctxParam) {
  try {
    const { objectSlug } = await ctxParam.params;
    const ctx = await authenticateApiRequest(request, 'records:write');
    const body = await request.json().catch(() => ({}));
    const record = await createRecord(ctx, { objectSlug, data: body?.data ?? body, source: 'API' });
    return Response.json({ data: record }, { status: 201 });
  } catch (err) {
    return errorResponse(err);
  }
}
