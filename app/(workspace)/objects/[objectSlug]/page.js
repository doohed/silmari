import { notFound } from 'next/navigation';
import { requireContext } from '@/lib/auth/dal';
import { getObjectViews } from '@/lib/views/service';
import { listRecords } from '@/lib/records/service';
import { NotFoundError } from '@/lib/errors/domain-errors';
import { ViewBar } from '@/components/record-table/ViewBar';
import { RecordTable } from '@/components/record-table/RecordTable';
import { RecordBoard } from '@/components/record-board/RecordBoard';

export default async function ObjectIndexPage({ params, searchParams }) {
  const { objectSlug } = await params;
  const sp = (await searchParams) ?? {};
  const ctx = await requireContext();

  let object;
  let views;
  try {
    ({ object, views } = await getObjectViews(ctx, objectSlug));
  } catch (err) {
    if (err instanceof NotFoundError) notFound();
    throw err;
  }

  const activeView =
    views.find((v) => v.id === sp.view) ?? views.find((v) => v.isDefault) ?? views[0];

  let initialPage = null;
  if (activeView.type === 'TABLE') {
    const byId = Object.fromEntries(object.fields.map((f) => [f.id, f]));
    const filters = (activeView.viewFilters ?? [])
      .map((f) => ({
        fieldName: byId[f.fieldMetadataId]?.name,
        operator: f.operator,
        value: f.value,
      }))
      .filter((f) => f.fieldName);
    const sorts = (activeView.viewSorts ?? [])
      .map((s) => ({ fieldName: byId[s.fieldMetadataId]?.name, direction: s.direction }))
      .filter((s) => s.fieldName);
    initialPage = await listRecords(ctx, { objectSlug, filters, sorts, limit: 100 });
  }

  return (
    <div className="flex h-full flex-col">
      <ViewBar objectSlug={objectSlug} views={views} activeViewId={activeView.id} />
      <div className="min-h-0 flex-1">
        {activeView.type === 'TABLE' ? (
          <RecordTable
            objectSlug={objectSlug}
            object={object}
            initialView={activeView}
            initialPage={initialPage}
          />
        ) : (
          <RecordBoard objectSlug={objectSlug} object={object} view={activeView} />
        )}
      </div>
    </div>
  );
}
