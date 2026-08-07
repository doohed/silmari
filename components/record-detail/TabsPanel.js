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

export function TabsPanel({ object, timeline, related, currentRecordId, onRelatedChange }) {
  const [tab, setTab] = useState('timeline');

  return (
    <div className="flex h-full flex-col">
      <div className="border-border flex shrink-0 gap-1 border-b px-4">
        {TABS.map((t) => (
          <button
            key={t.id}
            type="button"
            onClick={() => setTab(t.id)}
            className={`border-b-2 px-3 py-2.5 text-sm transition-colors ${
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
