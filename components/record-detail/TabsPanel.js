'use client';

import { useState } from 'react';
import { Timeline } from './Timeline';
import { RelationSection } from './RelationSection';
import { NotesTab } from '@/components/activities/NotesTab';
import { TasksTab } from '@/components/activities/TasksTab';
import { AttachmentsTab } from '@/components/activities/AttachmentsTab';
import { CommunicationsTab } from '@/components/activities/CommunicationsTab';

const TABS = [
  { id: 'timeline', label: 'Timeline' },
  { id: 'related', label: 'Relacionados' },
  { id: 'notes', label: 'Notas' },
  { id: 'tasks', label: 'Tareas' },
  { id: 'comms', label: 'Comunicaciones' },
  { id: 'files', label: 'Archivos' },
];

/**
 * Pestañas de la ficha. En el panel lateral se pasa `detailsContent` para que
 * "Detalles" (los campos) sea la primera pestaña y no una columna lateral que
 * roba ancho; en la página completa se omite (los campos van en un aside).
 */
export function TabsPanel({
  object,
  timeline,
  related,
  currentRecordId,
  onRelatedChange,
  detailsContent,
}) {
  const tabs = detailsContent ? [{ id: 'details', label: 'Detalles' }, ...TABS] : TABS;
  const [tab, setTab] = useState(tabs[0].id);

  return (
    <div className="flex h-full flex-col">
      {/* Misma banda y misma ALTURA que la cabecera de columnas de la tabla
        (`.mac-list-head`, `--list-head-h`): la ficha se abre pegada a la lista y
        las dos franjas de títulos tienen que cerrar en la misma línea. Sin
        `data-cols`, que aquí los divisores verticales convertirían las pestañas
        en columnas. Lo activo es una pastilla en relieve (`.mac-tab`) y no un
        subrayado: dentro de una banda de 30 px el subrayado se pega al hairline
        de abajo y se lee como un borde suelto. */}
      <div className="mac-list-head flex shrink-0 items-center gap-0.5 overflow-x-auto px-2">
        {tabs.map((t) => (
          <button
            key={t.id}
            type="button"
            onClick={() => setTab(t.id)}
            data-active={tab === t.id}
            aria-current={tab === t.id ? 'page' : undefined}
            className="mac-tab shrink-0 px-2.5 text-[11.5px] font-medium whitespace-nowrap"
          >
            {t.label}
          </button>
        ))}
      </div>

      <div className="min-h-0 flex-1 overflow-auto">
        {tab === 'details' && detailsContent}
        {tab === 'timeline' && <Timeline items={timeline} />}
        {tab === 'related' && (
          <RelationSection
            sections={related}
            currentRecordId={currentRecordId}
            onChange={onRelatedChange}
          />
        )}
        {tab === 'notes' && <NotesTab object={object} recordId={currentRecordId} />}
        {tab === 'tasks' && <TasksTab object={object} recordId={currentRecordId} />}
        {tab === 'comms' && <CommunicationsTab object={object} recordId={currentRecordId} />}
        {tab === 'files' && <AttachmentsTab object={object} recordId={currentRecordId} />}
      </div>
    </div>
  );
}

export default TabsPanel;
