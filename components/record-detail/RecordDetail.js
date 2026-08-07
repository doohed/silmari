'use client';

import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { toast } from 'sonner';
import {
  updateRecordAction,
  deleteRecordAction,
  getTimelineAction,
  getRelatedAction,
} from '@/app/(workspace)/objects/actions';
import { RecordHeader } from './RecordHeader';
import { FieldsPanel } from './FieldsPanel';
import { TabsPanel } from './TabsPanel';

export function RecordDetail({
  objectSlug,
  object,
  initialRecord,
  initialTimeline,
  initialRelated,
}) {
  const router = useRouter();
  const [record, setRecord] = useState(initialRecord);
  const [timeline, setTimeline] = useState(initialTimeline);
  const [related, setRelated] = useState(initialRelated);

  const idField = object.fields.find((f) => f.id === object.labelIdentifierFieldId);

  async function refreshTimeline() {
    const t = await getTimelineAction({ objectSlug, recordId: record.id });
    if (t.ok) setTimeline(t.data);
  }
  async function refreshRelated() {
    const r = await getRelatedAction({ objectMetadataId: object.id, recordId: record.id });
    if (r.ok) setRelated(r.data);
  }

  async function commitField(fieldName, value) {
    const prev = record;
    setRecord({ ...record, data: { ...record.data, [fieldName]: value } });
    const r = await updateRecordAction({
      objectSlug,
      recordId: record.id,
      data: { [fieldName]: value },
    });
    if (!r.ok) {
      setRecord(prev);
      toast.error(r.message || 'No se pudo guardar');
      return;
    }
    setRecord(r.data);
    refreshTimeline();
  }

  async function onDelete() {
    const r = await deleteRecordAction({ objectSlug, recordId: record.id });
    if (r.ok) {
      toast.success('Registro eliminado');
      router.push(`/objects/${objectSlug}`);
    } else {
      toast.error(r.message);
    }
  }

  const fieldsForPanel = object.fields.filter((f) => f.id !== object.labelIdentifierFieldId);

  return (
    <div className="anim-fade-up flex h-full flex-col">
      <RecordHeader
        objectSlug={objectSlug}
        object={object}
        record={record}
        idField={idField}
        onCommit={commitField}
        onDelete={onDelete}
      />
      <div className="flex min-h-0 flex-1">
        <aside className="border-border w-80 shrink-0 overflow-auto border-r">
          <FieldsPanel fields={fieldsForPanel} record={record} onCommit={commitField} />
        </aside>
        <div className="min-w-0 flex-1 overflow-auto">
          <TabsPanel
            object={object}
            timeline={timeline}
            related={related}
            currentRecordId={record.id}
            onRelatedChange={refreshRelated}
          />
        </div>
      </div>
    </div>
  );
}

export default RecordDetail;
