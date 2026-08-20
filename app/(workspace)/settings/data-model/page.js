import { requireContext } from '@/lib/auth/dal';
import { listObjects } from '@/lib/metadata/object-service';
import { ObjectsManager } from '@/components/settings/ObjectsManager';
import { SettingsPage } from '@/components/settings/SettingsPage';

export const metadata = { title: 'Modelo de datos · Silmari' };

export default async function DataModelPage() {
  const ctx = await requireContext();
  const objects = await listObjects(ctx, { includeInactive: true });
  return (
    <SettingsPage title="Modelo de datos">
      <ObjectsManager objects={objects} />
    </SettingsPage>
  );
}
