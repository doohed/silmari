'use client';

import { formatNumber } from '@/lib/utils/format';

const empty = <p className="text-tertiary text-sm">Sin datos</p>;
const color = (i) => `var(--viz-${(i % 8) + 1})`;

/**
 * Dona categórica: cada porción es una entidad (identidad → color). Paleta
 * validada (skill dataviz). Leyenda siempre presente; total en el centro.
 * @param {{ data: Array<{label:string,value:number}>, format:(n:number)=>string }} props
 */
export function DonutChart({ data, format }) {
  const rows = (data ?? []).filter((d) => d.value > 0);
  if (rows.length === 0) return empty;
  const total = rows.reduce((s, d) => s + d.value, 0);

  const R = 60;
  const C = 2 * Math.PI * R;
  const gap = 2; // hueco de 2px entre porciones (skill)

  // Precalcula fracción y offset acumulado (puro, sin reasignaciones).
  const fracs = rows.map((d) => d.value / total);
  const segments = rows.map((d, i) => ({
    ...d,
    frac: fracs[i],
    offset: fracs.slice(0, i).reduce((s, f) => s + f, 0),
  }));

  return (
    <div className="flex h-full items-center gap-4">
      <svg viewBox="0 0 160 160" className="h-full max-h-48 shrink-0" style={{ aspectRatio: '1' }}>
        <g transform="rotate(-90 80 80)">
          {segments.map((d, i) => {
            const len = Math.max(0, d.frac * C - gap);
            return (
              <circle
                key={d.label}
                cx="80"
                cy="80"
                r={R}
                fill="none"
                stroke={color(i)}
                strokeWidth="20"
                strokeDasharray={`${len} ${C - len}`}
                strokeDashoffset={-(d.offset * C)}
              >
                <title>{`${d.label}: ${format(d.value)} (${Math.round(d.frac * 100)}%)`}</title>
              </circle>
            );
          })}
        </g>
        <text
          x="80"
          y="76"
          textAnchor="middle"
          className="font-semibold"
          style={{ fontSize: 26, fill: 'var(--text-primary)' }}
        >
          {formatNumber(total)}
        </text>
        <text
          x="80"
          y="96"
          textAnchor="middle"
          style={{ fontSize: 11, fill: 'var(--text-tertiary)' }}
        >
          Total
        </text>
      </svg>

      <ul className="min-w-0 flex-1 space-y-1.5 overflow-auto text-xs">
        {rows.map((d, i) => (
          <li key={d.label} className="flex items-center gap-2">
            <span
              className="size-2.5 shrink-0 rounded-full"
              style={{ background: color(i) }}
              aria-hidden="true"
            />
            <span className="text-secondary min-w-0 flex-1 truncate" title={d.label}>
              {d.label}
            </span>
            <span className="text-tertiary tabular-nums">{format(d.value)}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}

export default DonutChart;
