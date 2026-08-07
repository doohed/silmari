import { authenticateApiRequest } from '@/lib/http/api-context';
import { listObjects } from '@/lib/metadata/object-service';
import { errorResponse } from '@/lib/errors/to-response';

export const dynamic = 'force-dynamic';

/** GET /api/v1/metadata/objects — lista los objetos del workspace. */
export async function GET(request) {
  try {
    const ctx = await authenticateApiRequest(request, 'records:read');
    const objects = await listObjects(ctx);
    return Response.json({ data: objects });
  } catch (err) {
    return errorResponse(err);
  }
}
