'use client';

/* El tamaño de la cifra lo manda el ANCHO DE LA TARJETA, no el largo del número:
   con una escalera por longitud, cuatro tarjetas iguales en fila salían cada una
   con un cuerpo distinto y la hilera se leía descuadrada. La tarjeta declara
   `@container` (ver `WidgetCard`) y aquí solo se escoge el escalón.
   Los cortes: por debajo de 9rem cabe poco más que un recuento; a partir de
   14rem entra un importe con separadores y moneda a cuerpo grande. */
const SIZE = 'text-base @[9rem]:text-lg @[14rem]:text-3xl';

/**
 * Cifra destacada (hero number). El "gráfico" correcto para un único valor.
 * Alineada a la izquierda y centrada en vertical: el rótulo del widget está
 * arriba a la izquierda, y una cifra centrada dejaba los dos textos sin eje
 * común.
 * @param {{ value: number, format: (n:number)=>string }} props
 */
export function StatTile({ value, format }) {
  const text = format(value ?? 0);
  return (
    <div className="flex h-full items-center">
      <p
        className={`text-primary ${SIZE} truncate font-semibold tracking-tight tabular-nums`}
        title={text}
      >
        {text}
      </p>
    </div>
  );
}

export default StatTile;
