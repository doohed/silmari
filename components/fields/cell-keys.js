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

/** Clases base para inputs de edición inline (ocupan la celda, sin cromo). */
export const cellInputClass =
  'h-full w-full bg-elevated px-2 text-sm text-primary outline-none ring-2 ring-accent';
