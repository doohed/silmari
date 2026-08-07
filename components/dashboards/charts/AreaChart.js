'use client';

const empty = <p className="text-tertiary text-sm">Sin datos</p>;

/**
 * Área/línea de una sola serie (cambio en el tiempo). Acento, relleno degradado,
 * trazo de 2px (no escala). Etiquetas X selectivas para no saturar.
 * @param {{ data: Array<{label:string,value:number}>, format:(n:number)=>string }} props
 */
export function AreaChart({ data, format }) {
  const rows = (data ?? []).filter(Boolean);
  if (rows.length === 0) return empty;

  const W = 500;
  const H = 200;
  const padTop = 12;
  const max = Math.max(1, ...rows.map((d) => d.value));
  const n = rows.length;
  const x = (i) => (n === 1 ? W / 2 : (i / (n - 1)) * W);
  const y = (v) => padTop + (1 - v / max) * (H - padTop);

  const pts = rows.map((d, i) => [x(i), y(d.value)]);
  const line = pts.map(([px, py], i) => `${i === 0 ? 'M' : 'L'}${px} ${py}`).join(' ');
  const area = `${line} L${x(n - 1)} ${H} L${x(0)} ${H} Z`;

  // Etiquetas X: primera, central y última (evita solapes).
  const ticks = [...new Set([0, Math.floor((n - 1) / 2), n - 1])];

  return (
    <div className="flex h-full flex-col">
      <div className="relative min-h-0 flex-1">
        <svg
          viewBox={`0 0 ${W} ${H}`}
          preserveAspectRatio="none"
          className="h-full w-full"
          aria-hidden="true"
        >
          <defs>
            <linearGradient id="areaFill" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="var(--accent)" stopOpacity="0.25" />
              <stop offset="100%" stopColor="var(--accent)" stopOpacity="0" />
            </linearGradient>
          </defs>
          {[0.5, 1].map((f) => (
            <line
              key={f}
              x1="0"
              x2={W}
              y1={padTop + f * (H - padTop)}
              y2={padTop + f * (H - padTop)}
              stroke="var(--border)"
              strokeWidth="1"
              vectorEffect="non-scaling-stroke"
            />
          ))}
          <path d={area} fill="url(#areaFill)" />
          <path
            d={line}
            fill="none"
            stroke="var(--accent)"
            strokeWidth="2"
            strokeLinejoin="round"
            strokeLinecap="round"
            vectorEffect="non-scaling-stroke"
          />
          {pts.map(([px, py], i) => (
            <circle key={i} cx={px} cy={py} r="4" fill="var(--accent)" vectorEffect="non-scaling-stroke">
              <title>{`${rows[i].label}: ${format(rows[i].value)}`}</title>
            </circle>
          ))}
        </svg>
      </div>
      <div className="text-tertiary mt-2 flex justify-between text-[11px]">
        {ticks.map((i) => (
          <span key={i}>{rows[i].label}</span>
        ))}
      </div>
    </div>
  );
}

export default AreaChart;
