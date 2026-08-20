import { headers } from 'next/headers';
import { requireContext } from '@/lib/auth/dal';
import { listObjects, getObjectById } from '@/lib/metadata/object-service';
import { listLeadIntakes } from '@/lib/leads/service';
import { LeadIntakesPanel } from '@/components/settings/LeadIntakesPanel';
import { SettingsPage } from '@/components/settings/SettingsPage';

export const metadata = { title: 'Entrada de leads · Silmari' };

export default async function LeadsPage() {
  const ctx = await requireContext();
  const [intakes, objects] = await Promise.all([listLeadIntakes(ctx), listObjects(ctx)]);

  // El mapeo necesita los campos de cada objeto. Son pocos objetos por
  // workspace, así que se cargan de una vez en vez de pedirlos al seleccionar.
  const objectsWithFields = await Promise.all(objects.map((o) => getObjectById(ctx, o.id)));

  const host = (await headers()).get('host') ?? 'localhost:3000';
  const protocol = host.startsWith('localhost') ? 'http' : 'https';
  const endpoint = `${protocol}://${host}/api/v1/intake/meta`;

  return (
    <SettingsPage title="Entrada de leads">
      <LeadIntakesPanel initialIntakes={intakes} objects={objectsWithFields} endpoint={endpoint} />
    </SettingsPage>
  );
}
