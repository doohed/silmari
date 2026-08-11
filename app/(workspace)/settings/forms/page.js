import { requireContext } from '@/lib/auth/dal';
import { listForms } from '@/lib/forms/service';
import { listObjects, getObjectBySlug } from '@/lib/metadata/object-service';
import { isWritableField } from '@/lib/field-types';
import { appUrl } from '@/lib/config/app';
import { FormsPanel } from '@/components/settings/FormsPanel';

/**
 * Ensambla para el editor: cada objeto con sus campos escribibles (los que puede
 * recoger un formulario). Pasa la URL de la app para construir el snippet y el
 * enlace alojado.
 */
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
    <div className="mx-auto max-w-2xl px-8 py-8">
      <h1 className="text-primary mb-1 text-xl font-semibold tracking-tight">Formularios</h1>
      <p className="text-secondary mb-6 text-sm">
        Formularios web que puedes embeber en tu sitio. Cada envío crea o actualiza un registro (por
        el campo clave), sin que quien lo rellena necesite cuenta.
      </p>
      <FormsPanel initialForms={forms} objects={objectsWithFields} appUrl={appUrl()} />
    </div>
  );
}
