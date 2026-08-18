import { getContext } from '@/lib/auth/dal';
import { readAttachment } from '@/lib/attachments/service';
import { contentDisposition } from '@/lib/attachments/limits';
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
        // Solo se muestran en línea los tipos inofensivos; el resto se descarga.
        // Un adjunto servido desde nuestro origen no debe poder ejecutarse como
        // documento, aunque la lista blanca de subida ya lo dificulte.
        'Content-Disposition': contentDisposition({ mimeType, name }),
        'X-Content-Type-Options': 'nosniff',
        // Ni proxies ni CDN deben cachear datos de un tenant.
        'Cache-Control': 'private, no-store',
      },
    });
  } catch (err) {
    return errorResponse(err);
  }
}
