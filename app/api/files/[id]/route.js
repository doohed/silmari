import { getContext } from '@/lib/auth/dal';
import { readAttachment } from '@/lib/attachments/service';
import { errorResponse } from '@/lib/errors/to-response';
import { UnauthorizedError } from '@/lib/errors/domain-errors';

export const dynamic = 'force-dynamic';

/** GET /api/files/:id — sirve el binario de un adjunto (con sesión). */
export async function GET(request, ctxParam) {
  try {
    const { id } = await ctxParam.params;
    const ctx = await getContext();
    if (!ctx) throw new UnauthorizedError();

    const { buffer, mimeType, name } = await readAttachment(ctx, id);
    return new Response(buffer, {
      headers: {
        'Content-Type': mimeType,
        'Content-Disposition': `inline; filename="${encodeURIComponent(name)}"`,
      },
    });
  } catch (err) {
    return errorResponse(err);
  }
}
