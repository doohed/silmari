import { headers } from 'next/headers';
import { requireContext } from '@/lib/auth/dal';
import { listObjects, getObjectById } from '@/lib/metadata/object-service';
import { listLeadIntakes } from '@/lib/leads/service';
import { LeadIntakesPanel } from '@/components/settings/LeadIntakesPanel';

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
    <div className="mx-auto max-w-2xl px-8 py-8">
      <h1 className="text-primary mb-1 text-xl font-semibold tracking-tight">Entrada de leads</h1>
      <p className="text-secondary mb-6 text-sm">
        Convierte los leads de tus formularios de Meta (Facebook e Instagram) en registros. Zapier o
        Make reenvían el lead a Silmari y aquí decides a qué objeto va y cómo se traduce cada
        pregunta.
      </p>
      <LeadIntakesPanel initialIntakes={intakes} objects={objectsWithFields} endpoint={endpoint} />
    </div>
  );
}
