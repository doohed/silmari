import { requireContext } from '@/lib/auth/dal';
import { listTemplates } from '@/lib/templates/service';
import { listObjects, getObjectBySlug } from '@/lib/metadata/object-service';
import { TemplatesPanel } from '@/components/settings/TemplatesPanel';
import { SettingsPage } from '@/components/settings/SettingsPage';

/**
 * Ensambla para el editor: cada objeto con los nombres de sus campos (las
 * variables `{{campo}}` insertables) para la vista previa y los chips.
 */
export const metadata = { title: 'Plantillas · Silmari' };

export default async function TemplatesPage() {
  const ctx = await requireContext();
  const [templates, objects] = await Promise.all([listTemplates(ctx), listObjects(ctx)]);

  const objectsWithFields = await Promise.all(
    objects.map(async (o) => {
      const full = await getObjectBySlug(ctx, o.slug);
      return {
        slug: o.slug,
        labelSingular: o.labelSingular,
        fields: full.fields.map((f) => ({ name: f.name, label: f.label })),
      };
    }),
  );

  return (
    <SettingsPage title="Plantillas">
      <TemplatesPanel initialTemplates={templates} objects={objectsWithFields} />
    </SettingsPage>
  );
}
