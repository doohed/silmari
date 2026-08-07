'use client';

import { formatCurrency, formatNumber } from '@/lib/utils/format';
import { useWorkspaceSettings } from '@/components/providers/WorkspaceProvider';
import { widgetDef } from '@/lib/dashboards/catalog';
import { BarChart } from './charts/BarChart';
import { HBarChart } from './charts/HBarChart';
import { DonutChart } from './charts/DonutChart';
import { AreaChart } from './charts/AreaChart';
import { StatTile } from './charts/StatTile';

/**
 * Renderiza el gráfico de un widget según el catálogo, formateando importes con
 * la moneda del workspace.
 * @param {{ type: string, metrics: object }} props
 */
export function Widget({ type, metrics }) {
  const { currency } = useWorkspaceSettings();
  const def = widgetDef(type);
  if (!def) return null;

  const format = (n) => (def.unit === 'currency' ? formatCurrency(n, currency) : formatNumber(n));
  const data = metrics?.[def.dataKey];

  switch (def.kind) {
    case 'stat':
      return <StatTile value={data ?? 0} format={format} />;
    case 'bar':
      return <BarChart data={data} format={format} />;
    case 'hbar':
      return <HBarChart data={data} format={format} />;
    case 'donut':
      return <DonutChart data={data} format={format} />;
    case 'area':
      return <AreaChart data={data} format={format} />;
    default:
      return null;
  }
}

/** ¿El widget es una cifra (tarjeta compacta) o un gráfico (tarjeta alta)? */
export function isStatWidget(type) {
  return widgetDef(type)?.kind === 'stat';
}

export default Widget;
