/**
 * Manejador de teclado común para los editores de celda simples:
 * Enter confirma, Escape cancela. (Tab lo gestiona la tabla.)
 * @param {(commit: boolean) => void} finish  finish(true) confirma, finish(false) cancela
 */
export function cellKeyDown(finish) {
  return (e) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      finish(true);
    } else if (e.key === 'Escape') {
      e.preventDefault();
      finish(false);
    }
  };
}

/**
 * Clases base para inputs de edición inline: ocupan la celda exacta, sin cromo.
 *
 * Tres cosas que tienen que cuadrar con la celda de al lado, o al empezar a
 * editar el texto «salta»:
 * - **`ring-inset`**. Con el anillo por fuera, sus 2 px se salían de los 32 px
 *   de la fila por arriba y por abajo, y la caja naranja aparecía montada
 *   sobre las filas vecinas en vez de dentro de la suya.
 * - **`px-3`**, la misma sangría que `CellContent`; con `px-2` el valor se
 *   desplazaba 4 px a la izquierda en cuanto entrabas a editar.
 * - **`text-[13px]`**, el cuerpo de la app; `text-sm` son 14 px y el texto
 *   crecía al editarse.
 */
export const cellInputClass =
  'h-full w-full rounded-[7px] bg-elevated px-3 text-[13px] text-primary outline-none ring-2 ring-accent ring-inset';
