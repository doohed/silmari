import { requireContext } from '@/lib/auth/dal';
import { listAutomations } from '@/lib/automations/service';
import { listObjects, getObjectBySlug } from '@/lib/metadata/object-service';
import { listMembers } from '@/lib/members/service';
import { getFieldType, isWritableField } from '@/lib/field-types';
import { AutomationsPanel } from '@/components/settings/AutomationsPanel';
import { SettingsPage } from '@/components/settings/SettingsPage';

/**
 * Ensambla para el editor: cada objeto con sus campos (nombre, etiqueta, tipo,
 * operadores de filtro válidos y si es escribible), y la lista de miembros para
 * los selectores de responsables/destinatarios.
 */
export const metadata = { title: 'Automatizaciones · Silmari' };

export default async function AutomationsPage() {
  const ctx = await requireContext();
  const [automations, objects, members] = await Promise.all([
    listAutomations(ctx),
    listObjects(ctx),
    listMembers(ctx),
  ]);

  const objectsWithFields = await Promise.all(
    objects.map(async (o) => {
      const full = await getObjectBySlug(ctx, o.slug);
      return {
        id: o.id,
        slug: o.slug,
        nameSingular: o.nameSingular,
        labelSingular: o.labelSingular,
        labelPlural: o.labelPlural,
        fields: full.fields.map((f) => ({
          name: f.name,
          label: f.label,
          type: f.type,
          operators: getFieldType(f.type).filterOperators,
          writable: isWritableField(f),
          // Las opciones reales de un SELECT: el editor de condiciones las
          // ofrece en un desplegable en vez de pedir el valor a mano, que era
          // la forma de escribir una condición que no casaba nunca.
          options: (f.options ?? []).map((o) => ({ value: o.value, label: o.label })),
        })),
      };
    }),
  );

  return (
    <SettingsPage title="Automatizaciones">
      <AutomationsPanel
        initialAutomations={automations}
        objects={objectsWithFields}
        members={members.map((m) => ({ userId: m.userId, name: m.name }))}
      />
    </SettingsPage>
  );
}
