import { requireContext } from '@/lib/auth/dal';
import { listDashboards } from '@/lib/dashboards/service';
import { DashboardList } from '@/components/dashboards/DashboardList';

export const metadata = { title: 'Paneles · Silmari' };

export default async function DashboardsPage() {
  const ctx = await requireContext();
  const dashboards = await listDashboards(ctx);
  return <DashboardList dashboards={dashboards} />;
}
