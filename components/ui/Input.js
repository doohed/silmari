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
        'bg-surface text-primary placeholder:text-tertiary h-10 w-full rounded-lg border px-3.5',
        'border-border focus:border-accent focus:outline-none',
        'transition-[border-color] duration-150',
        className,
      )}
      {...props}
    />
  );
}

export default Input;
