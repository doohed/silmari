'use client';

const empty = <p className="text-tertiary text-sm">Sin datos</p>;

/**
 * Barras horizontales de una sola serie (ranking). Útil con etiquetas largas
 * (p. ej. nombres de responsables).
 *
 * Las filas se **anclan arriba**, no al centro: con un solo responsable la
 * tarjeta dejaba la barra flotando en mitad de un rectángulo vacío. Un ranking
 * empieza por el primer puesto y crece hacia abajo, y si no caben todas las
 * filas la lista se desplaza dentro de la tarjeta.
 *
 * @param {{ data: Array<{label:string,value:number}>, format:(n:number)=>string }} props
 */
export function HBarChart({ data, format }) {
  const rows = (data ?? []).filter(Boolean);
  if (rows.length === 0) return empty;
  const max = Math.max(1, ...rows.map((d) => d.value));

  return (
    <div className="flex h-full flex-col gap-2 overflow-y-auto">
      {rows.map((d) => (
        <div key={d.label} className="flex shrink-0 items-center gap-2 text-[11.5px]">
          <span className="text-secondary w-20 shrink-0 truncate text-right" title={d.label}>
            {d.label}
          </span>
          {/* Carril hundido (`--sunken`), el mismo recurso que el control
            segmentado: marca el 100 % sin dibujar un borde. */}
          <div className="bg-sunken h-4.5 min-w-0 flex-1 overflow-hidden rounded-[4px]">
            <div
              title={`${d.label}: ${format(d.value)}`}
              className="bg-accent h-full rounded-[4px] transition-opacity hover:opacity-80"
              style={{ width: `${(d.value / max) * 100}%`, minWidth: d.value > 0 ? 3 : 0 }}
            />
          </div>
          <span className="text-primary shrink-0 text-right font-medium tabular-nums">
            {format(d.value)}
          </span>
        </div>
      ))}
    </div>
  );
}

export default HBarChart;
