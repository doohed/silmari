import { notFound } from 'next/navigation';
import { requireContext } from '@/lib/auth/dal';
import { getDashboard, listDashboards, getOpportunityMetrics } from '@/lib/dashboards/service';
import { NotFoundError } from '@/lib/errors/domain-errors';
import { DashboardView } from '@/components/dashboards/DashboardView';

export const metadata = { title: 'Panel · Silmari' };

export default async function DashboardDetailPage({ params }) {
  const ctx = await requireContext();
  const { id } = await params;
  let dashboard;
  try {
    dashboard = await getDashboard(ctx, { id });
  } catch (err) {
    if (err instanceof NotFoundError) notFound();
    throw err;
  }
  // Los paneles hermanos alimentan la banda de pestañas: cambiar de panel sin
  // pasar por la lista. Solo hacen falta id y nombre, no sus widgets.
  const [panels, metrics] = await Promise.all([listDashboards(ctx), getOpportunityMetrics(ctx)]);
  return (
    <DashboardView
      dashboard={dashboard}
      panels={panels.map((p) => ({ id: p.id, name: p.name }))}
      metrics={metrics}
    />
  );
}
