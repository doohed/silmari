import { Download } from 'lucide-react';
import { requireContext } from '@/lib/auth/dal';
import { can } from '@/lib/auth/permissions';
import { getCurrentWorkspace } from '@/lib/workspaces/service';
import { WorkspaceForm } from '@/components/settings/WorkspaceForm';
import { SettingsPage } from '@/components/settings/SettingsPage';
import { SettingsGroup, SettingsRow } from '@/components/ui/SettingsGroup';

export const metadata = { title: 'Espacio de trabajo · Silmari' };

export default async function WorkspaceSettingsPage() {
  const ctx = await requireContext();
  const workspace = await getCurrentWorkspace(ctx);

  return (
    <SettingsPage title="Espacio de trabajo">
      <WorkspaceForm workspace={workspace} />

      {can(ctx, 'workspace:update') && (
        <SettingsGroup
          title="Datos"
          footnote="El archivo incluye la definición de los campos, para que se entienda sin la aplicación."
        >
          <SettingsRow
            label="Exportar tus datos"
            hint="Objetos, campos, registros, notas y tareas en un JSON"
          >
            {/* Enlace y no botón: la descarga la sirve una ruta con sus cabeceras. */}
            <a
              href="/api/export"
              download
              className="press mac-focus border-border bg-surface text-primary hover:bg-sunken inline-flex h-8 items-center gap-1.5 rounded-lg border px-3.5 text-[13px] font-medium shadow-xs"
            >
              <Download size={13} /> Descargar
            </a>
          </SettingsRow>
        </SettingsGroup>
      )}
    </SettingsPage>
  );
}
