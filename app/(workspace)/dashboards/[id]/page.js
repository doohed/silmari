import { notFound } from 'next/navigation';
import { requireContext } from '@/lib/auth/dal';
import { getDashboard, getOpportunityMetrics } from '@/lib/dashboards/service';
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
  const metrics = await getOpportunityMetrics(ctx);
  return <DashboardView dashboard={dashboard} metrics={metrics} />;
}
