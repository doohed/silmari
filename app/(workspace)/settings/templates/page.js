import { requireContext } from '@/lib/auth/dal';
import { listTemplates } from '@/lib/templates/service';
import { listObjects, getObjectBySlug } from '@/lib/metadata/object-service';
import { TemplatesPanel } from '@/components/settings/TemplatesPanel';

/**
 * Ensambla para el editor: cada objeto con los nombres de sus campos (las
 * variables `{{campo}}` insertables) para la vista previa y los chips.
 */
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
    <div className="mx-auto max-w-2xl px-8 py-8">
      <h1 className="text-primary mb-1 text-xl font-semibold tracking-tight">Plantillas</h1>
      <p className="text-secondary mb-6 text-sm">
        Mensajes reutilizables con variables <span className="font-mono">{'{{campo}}'}</span> que se
        rellenan con los datos del registro. Las usarán el email y WhatsApp al escribir.
      </p>
      <TemplatesPanel initialTemplates={templates} objects={objectsWithFields} />
    </div>
  );
}
