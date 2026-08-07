import { getContext } from '@/lib/auth/dal';
import { getStorage } from '@/lib/storage';
import { createAttachment } from '@/lib/attachments/service';
import { errorResponse } from '@/lib/errors/to-response';
import { UnauthorizedError, ValidationError } from '@/lib/errors/domain-errors';

export const dynamic = 'force-dynamic';

/** POST /api/upload — sube un archivo (multipart) y lo registra como adjunto. */
export async function POST(request) {
  try {
    const ctx = await getContext();
    if (!ctx) throw new UnauthorizedError();

    const form = await request.formData();
    const file = form.get('file');
    if (!file || typeof file.arrayBuffer !== 'function') {
      throw new ValidationError('No se recibió ningún archivo');
    }

    let targets = [];
    try {
      targets = JSON.parse(form.get('targets') || '[]');
    } catch {
      throw new ValidationError('Targets no válidos');
    }

    const buffer = Buffer.from(await file.arrayBuffer());
    const { key, size } = await getStorage().put({
      workspaceId: ctx.workspaceId,
      filename: file.name || 'archivo',
      buffer,
    });

    const attachment = await createAttachment(ctx, {
      name: file.name || 'archivo',
      mimeType: file.type || 'application/octet-stream',
      size,
      storageKey: key,
      targets,
    });

    return Response.json({ data: attachment }, { status: 201 });
  } catch (err) {
    return errorResponse(err);
  }
}
