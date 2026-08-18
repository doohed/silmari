import { cn } from '@/lib/utils/cn';

/**
 * Input de texto base. En React 19 `ref` se pasa como prop normal, así que
 * `register()` de React Hook Form funciona directamente.
 * @param {object} props
 * @param {string} [props.className]
 */
export function Input({ className, ref, ...props }) {
  return (
    <input
      ref={ref}
      className={cn(
        'bg-surface text-primary placeholder:text-tertiary h-8 w-full rounded-lg border px-2.5 text-[13px]',
        // El campo de macOS lleva borde de énfasis (no hairline) y al enfocar
        // se rodea de un halo ancho del color de acento, no de un borde grueso.
        'border-border-strong mac-focus shadow-xs',
        'transition-[border-color,box-shadow] duration-150',
        className,
      )}
      {...props}
    />
  );
}

export default Input;
