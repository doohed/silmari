import { Download } from 'lucide-react';
import { requireContext } from '@/lib/auth/dal';
import { can } from '@/lib/auth/permissions';
import { getCurrentWorkspace } from '@/lib/workspaces/service';
import { WorkspaceForm } from '@/components/settings/WorkspaceForm';

export default async function WorkspaceSettingsPage() {
  const ctx = await requireContext();
  const workspace = await getCurrentWorkspace(ctx);
  return (
    <div className="mx-auto max-w-2xl px-8 py-8">
      <h1 className="text-primary mb-6 text-xl font-semibold tracking-tight">Espacio de trabajo</h1>
      <WorkspaceForm workspace={workspace} />

      {can(ctx, 'workspace:update') && (
        <section className="border-border mt-10 border-t pt-6">
          <h2 className="text-primary mb-1 text-sm font-medium">Exportar tus datos</h2>
          <p className="text-secondary mb-3 text-xs">
            Descarga todo el contenido del espacio de trabajo en un JSON: objetos, campos,
            registros, notas y tareas. Incluye la definición de los campos para que el archivo se
            entienda sin la aplicación.
          </p>
          {/* Enlace y no botón: la descarga la sirve una ruta con sus cabeceras. */}
          <a
            href="/api/export"
            download
            className="press border-border hover:bg-chip-gray text-primary inline-flex h-8 items-center gap-1.5 rounded-md border px-3 text-xs"
          >
            <Download size={13} /> Descargar exportación
          </a>
        </section>
      )}
    </div>
  );
}
