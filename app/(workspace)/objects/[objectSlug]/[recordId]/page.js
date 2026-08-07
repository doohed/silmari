import { notFound } from 'next/navigation';
import { requireContext } from '@/lib/auth/dal';
import { getObjectBySlug } from '@/lib/metadata/object-service';
import { getRecord } from '@/lib/records/service';
import { listTimelineReadable } from '@/lib/timeline/readable';
import { getRelatedRecords } from '@/lib/relations/service';
import { NotFoundError } from '@/lib/errors/domain-errors';
import { RecordDetail } from '@/components/record-detail/RecordDetail';

export default async function RecordDetailPage({ params }) {
  const { objectSlug, recordId } = await params;
  const ctx = await requireContext();

  let object;
  let record;
  try {
    object = await getObjectBySlug(ctx, objectSlug);
    record = await getRecord(ctx, { objectSlug, recordId });
  } catch (err) {
    if (err instanceof NotFoundError) notFound();
    throw err;
  }

  const [timeline, related] = await Promise.all([
    listTimelineReadable(ctx, { objectSlug, recordId }),
    getRelatedRecords(ctx, { objectMetadataId: object.id, recordId }),
  ]);

  return (
    <RecordDetail
      objectSlug={objectSlug}
      object={object}
      initialRecord={record}
      initialTimeline={timeline}
      initialRelated={related}
    />
  );
}
