'use client';

import { useState } from 'react';
import { Timeline } from './Timeline';
import { RelationSection } from './RelationSection';
import { NotesTab } from '@/components/activities/NotesTab';
import { TasksTab } from '@/components/activities/TasksTab';
import { AttachmentsTab } from '@/components/activities/AttachmentsTab';

const TABS = [
  { id: 'timeline', label: 'Timeline' },
  { id: 'related', label: 'Relacionados' },
  { id: 'notes', label: 'Notas' },
  { id: 'tasks', label: 'Tareas' },
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
      <div className="border-border flex h-9 shrink-0 items-center gap-1 overflow-x-auto border-b px-3">
        {tabs.map((t) => (
          <button
            key={t.id}
            type="button"
            onClick={() => setTab(t.id)}
            className={`-mb-px h-9 shrink-0 border-b-2 px-2.5 text-[13px] transition-colors ${
              tab === t.id
                ? 'border-accent text-primary font-medium'
                : 'text-secondary hover:text-primary border-transparent'
            }`}
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
        {tab === 'files' && <AttachmentsTab object={object} recordId={currentRecordId} />}
      </div>
    </div>
  );
}

export default TabsPanel;
