import { requireContext } from '@/lib/auth/dal';
import { listForms } from '@/lib/forms/service';
import { listObjects, getObjectBySlug } from '@/lib/metadata/object-service';
import { isWritableField } from '@/lib/field-types';
import { appUrl } from '@/lib/config/app';
import { FormsPanel } from '@/components/settings/FormsPanel';
import { SettingsPage } from '@/components/settings/SettingsPage';

/**
 * Ensambla para el editor: cada objeto con sus campos escribibles (los que puede
 * recoger un formulario). Pasa la URL de la app para construir el snippet y el
 * enlace alojado.
 */
export const metadata = { title: 'Formularios · Silmari' };

export default async function FormsPage() {
  const ctx = await requireContext();
  const [forms, objects] = await Promise.all([listForms(ctx), listObjects(ctx)]);

  const objectsWithFields = await Promise.all(
    objects.map(async (o) => {
      const full = await getObjectBySlug(ctx, o.slug);
      return {
        id: o.id,
        slug: o.slug,
        labelSingular: o.labelSingular,
        fields: full.fields
          .filter((f) => isWritableField(f))
          .map((f) => ({ name: f.name, label: f.label, type: f.type })),
      };
    }),
  );

  return (
    <SettingsPage title="Formularios">
      <FormsPanel initialForms={forms} objects={objectsWithFields} appUrl={appUrl()} />
    </SettingsPage>
  );
}
