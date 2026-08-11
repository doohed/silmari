import { notFound } from 'next/navigation';
import { getPublicForm } from '@/lib/forms/service';
import { PublicFormRenderer } from '@/components/forms/PublicFormRenderer';

export const dynamic = 'force-dynamic';

/**
 * Página pública alojada de un formulario web (`/forms/<slug>`). Standalone: usa
 * el layout raíz (sin el chrome del workspace). Accesible sin sesión gracias a
 * `PUBLIC_PREFIXES` en `proxy.js`.
 */
export default async function PublicFormPage({ params }) {
  const { slug } = await params;
  let form = null;
  try {
    form = await getPublicForm(slug);
  } catch {
    form = null;
  }
  if (!form) notFound();

  return (
    <main className="bg-bg flex min-h-screen items-center justify-center p-4">
      <div className="w-full max-w-md">
        <PublicFormRenderer form={form} />
      </div>
    </main>
  );
}
