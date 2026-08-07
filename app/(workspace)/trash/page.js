import { requireContext } from '@/lib/auth/dal';
import { listAllTrash } from '@/lib/records/service';
import { TrashPanel } from '@/components/records/TrashPanel';

export const metadata = { title: 'Papelera · Silmari' };

export default async function TrashPage() {
  const ctx = await requireContext();
  const groups = await listAllTrash(ctx);
  return (
    <div className="mx-auto max-w-2xl px-6 py-8">
      <h1 className="text-primary mb-6 text-xl font-semibold tracking-tight">Papelera</h1>
      <TrashPanel initialGroups={groups} />
    </div>
  );
}
