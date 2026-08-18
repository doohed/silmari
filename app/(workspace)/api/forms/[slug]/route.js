import { getPublicForm, submitPublicForm } from '@/lib/forms/service';
import { consumeRateLimit } from '@/lib/http/rate-limit';
import { errorResponse } from '@/lib/errors/to-response';

export const dynamic = 'force-dynamic';

/**
 * Endpoints **públicos** de un formulario web (sin API key ni sesión: el proxy
 * excluye `api`, y el workspace se resuelve desde el slug del formulario).
 *
 * GET  /api/forms/[slug]        → esquema para renderizar el formulario.
 * POST /api/forms/[slug]        → procesa un envío ({ values, _hp }).
 */
export async function GET(_request, ctx) {
  try {
    const { slug } = await ctx.params;
    const form = await getPublicForm(slug);
    return Response.json({ data: form });
  } catch (err) {
    return errorResponse(err);
  }
}

export async function POST(request, ctx) {
  try {
    const { slug } = await ctx.params;
    const ip = request.headers.get('x-forwarded-for')?.split(',')[0]?.trim() || 'anon';
    consumeRateLimit(`form:${slug}:${ip}`, { limit: 20, windowMs: 60_000 });

    const body = await request.json().catch(() => ({}));
    const result = await submitPublicForm(slug, body?.values ?? {}, { honeypot: body?._hp });
    return Response.json({ data: result }, { status: result.action === 'created' ? 201 : 200 });
  } catch (err) {
    return errorResponse(err);
  }
}
