'use client';

const empty = <p className="text-tertiary text-sm">Sin datos</p>;

/**
 * Barras verticales de una sola serie (magnitud). Marca en acento, extremo
 * redondeado anclado a la base, etiqueta de valor selectiva encima.
 * @param {{ data: Array<{label:string,value:number}>, format:(n:number)=>string }} props
 */
export function BarChart({ data, format }) {
  const rows = (data ?? []).filter(Boolean);
  if (rows.length === 0) return empty;
  const max = Math.max(1, ...rows.map((d) => d.value));

  return (
    <div className="flex h-full gap-2 pt-6">
      {rows.map((d) => (
        <div key={d.label} className="flex min-w-0 flex-1 flex-col items-center gap-1.5">
          <div className="flex w-full flex-1 flex-col justify-end">
            <span className="text-secondary mb-1 text-center text-[11px] font-medium tabular-nums">
              {format(d.value)}
            </span>
            <div
              title={`${d.label}: ${format(d.value)}`}
              className="bg-accent mx-auto w-full max-w-12 rounded-t transition-opacity hover:opacity-80"
              style={{ height: `${(d.value / max) * 100}%`, minHeight: d.value > 0 ? 4 : 0 }}
            />
          </div>
          <span className="text-tertiary w-full truncate text-center text-[11px]" title={d.label}>
            {d.label}
          </span>
        </div>
      ))}
    </div>
  );
}

export default BarChart;
