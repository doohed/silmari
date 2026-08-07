import { requireContext } from '@/lib/auth/dal';
import { listObjects } from '@/lib/metadata/object-service';
import { ObjectsManager } from '@/components/settings/ObjectsManager';

export default async function DataModelPage() {
  const ctx = await requireContext();
  const objects = await listObjects(ctx, { includeInactive: true });
  return (
    <div className="mx-auto max-w-2xl px-8 py-8">
      <h1 className="text-primary mb-6 text-xl font-semibold tracking-tight">Modelo de datos</h1>
      <ObjectsManager objects={objects} />
    </div>
  );
}
