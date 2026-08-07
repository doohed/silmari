'use client';

/**
 * Cifra destacada (hero number). El "gráfico" correcto para un único valor.
 * @param {{ value: number, format: (n:number)=>string }} props
 */
export function StatTile({ value, format }) {
  return (
    <div className="flex h-full flex-col justify-center">
      <p className="text-primary text-3xl font-semibold tracking-tight tabular-nums">
        {format(value ?? 0)}
      </p>
    </div>
  );
}

export default StatTile;
