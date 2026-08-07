'use client';

const empty = <p className="text-tertiary text-sm">Sin datos</p>;

/**
 * Barras horizontales de una sola serie (ranking). Útil con etiquetas largas
 * (p. ej. nombres de responsables).
 * @param {{ data: Array<{label:string,value:number}>, format:(n:number)=>string }} props
 */
export function HBarChart({ data, format }) {
  const rows = (data ?? []).filter(Boolean);
  if (rows.length === 0) return empty;
  const max = Math.max(1, ...rows.map((d) => d.value));

  return (
    <div className="flex h-full flex-col justify-center gap-2.5">
      {rows.map((d) => (
        <div key={d.label} className="flex items-center gap-2 text-xs">
          <span className="text-tertiary w-24 shrink-0 truncate text-right" title={d.label}>
            {d.label}
          </span>
          <div className="bg-chip-gray/50 h-5 flex-1 overflow-hidden rounded">
            <div
              title={`${d.label}: ${format(d.value)}`}
              className="bg-accent h-full rounded transition-opacity hover:opacity-80"
              style={{ width: `${(d.value / max) * 100}%`, minWidth: d.value > 0 ? 3 : 0 }}
            />
          </div>
          <span className="text-secondary w-10 shrink-0 text-right font-medium tabular-nums">
            {format(d.value)}
          </span>
        </div>
      ))}
    </div>
  );
}

export default HBarChart;
