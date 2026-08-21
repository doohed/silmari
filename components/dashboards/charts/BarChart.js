'use client';

const empty = <p className="text-tertiary text-sm">Sin datos</p>;

/**
 * Barras verticales de una sola serie (magnitud). Marca en acento, extremo
 * redondeado anclado a la base y línea base hairline, como los gráficos de
 * Numbers: la referencia es la base, no una rejilla completa.
 *
 * La etiqueta de valor va **colgada de la barra** (posicionada respecto a ella),
 * no apilada encima dentro de la misma columna flexible: apilada le robaba alto
 * al área de trazado y obligaba a un `padding` a ojo para que la barra más alta
 * no se comiera su propio número.
 *
 * @param {{ data: Array<{label:string,value:number}>, format:(n:number)=>string }} props
 */
export function BarChart({ data, format }) {
  const rows = (data ?? []).filter(Boolean);
  if (rows.length === 0) return empty;
  const max = Math.max(1, ...rows.map((d) => d.value));

  return (
    <div className="flex h-full flex-col">
      {/* `pt-4`: el hueco justo para la etiqueta de la barra más alta. */}
      <div className="flex min-h-0 flex-1 items-end gap-2 pt-4">
        {rows.map((d) => {
          const pct = (d.value / max) * 100;
          return (
            <div
              key={d.label}
              className="relative flex h-full min-w-0 flex-1 items-end justify-center"
            >
              <div
                title={`${d.label}: ${format(d.value)}`}
                className="bg-accent w-full max-w-10 rounded-t-[3px] transition-opacity hover:opacity-80"
                style={{ height: `${pct}%`, minHeight: d.value > 0 ? 4 : 0 }}
              />
              {/* La etiqueta se ancla a la COLUMNA, no a la barra, y se sube a la
                altura de esta con `bottom`. Colgada de la barra sobraba sitio en
                los recuentos («17») pero un importe se recortaba a «2.14…»: la
                barra mide 40 px y la columna, el triple. */}
              <span
                className="text-secondary absolute inset-x-0 truncate text-center text-[11px] font-medium tabular-nums"
                style={{ bottom: `calc(${pct}% + 4px)` }}
              >
                {format(d.value)}
              </span>
            </div>
          );
        })}
      </div>

      <div className="border-border mt-0 border-t" />

      <div className="mt-1.5 flex gap-2">
        {rows.map((d) => (
          <span
            key={d.label}
            className="text-tertiary min-w-0 flex-1 truncate text-center text-[11px]"
            title={d.label}
          >
            {d.label}
          </span>
        ))}
      </div>
    </div>
  );
}

export default BarChart;
