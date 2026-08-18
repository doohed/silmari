import { getContext } from '@/lib/auth/dal';
import { exportWorkspace } from '@/lib/accounts/export-workspace';
import { errorResponse } from '@/lib/errors/to-response';
import { UnauthorizedError } from '@/lib/errors/domain-errors';

export const dynamic = 'force-dynamic';

/**
 * GET /api/export — descarga el volcado completo del espacio de trabajo (RGPD,
 * derecho de portabilidad).
 *
 * Es una ruta y no una server action porque el resultado es una **descarga**:
 * las server actions devuelven datos a React, no un fichero con sus cabeceras.
 */
export async function GET() {
  try {
    const ctx = await getContext();
    if (!ctx) throw new UnauthorizedError();

    const data = await exportWorkspace(ctx);
    const filename = `silmari-${data.workspace.slug ?? 'export'}-${data.exportedAt.slice(0, 10)}.json`;

    return new Response(JSON.stringify(data, null, 2), {
      headers: {
        'Content-Type': 'application/json; charset=utf-8',
        'Content-Disposition': `attachment; filename*=UTF-8''${encodeURIComponent(filename)}`,
        'Cache-Control': 'private, no-store',
      },
    });
  } catch (err) {
    return errorResponse(err);
  }
}
