import Link from 'next/link';
import { notFound } from 'next/navigation';
import { ArrowLeft } from 'lucide-react';
import { requireContext } from '@/lib/auth/dal';
import { getObjectBySlug, listObjects } from '@/lib/metadata/object-service';
import { NotFoundError } from '@/lib/errors/domain-errors';
import { FieldsManager } from '@/components/settings/FieldsManager';

export default async function ObjectFieldsPage({ params }) {
  const { objectSlug } = await params;
  const ctx = await requireContext();

  let object;
  let objects;
  try {
    [object, objects] = await Promise.all([
      getObjectBySlug(ctx, objectSlug),
      listObjects(ctx, { includeInactive: true }),
    ]);
  } catch (err) {
    if (err instanceof NotFoundError) notFound();
    throw err;
  }

  return (
    <div className="mx-auto max-w-2xl px-8 py-8">
      <Link
        href="/settings/data-model"
        className="text-tertiary hover:text-primary mb-4 inline-flex items-center gap-1 text-xs"
      >
        <ArrowLeft size={14} /> Modelo de datos
      </Link>
      <h1 className="text-primary mb-6 text-xl font-semibold tracking-tight">
        {object.labelPlural}
      </h1>
      <FieldsManager object={object} objects={objects} />
    </div>
  );
}
