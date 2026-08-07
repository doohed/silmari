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
        'bg-surface text-primary placeholder:text-tertiary h-9 w-full rounded-md border px-3 text-[13px]',
        'border-border focus:border-accent focus:ring-accent/15 focus:ring-2 focus:outline-none',
        'transition-[border-color,box-shadow] duration-150',
        className,
      )}
      {...props}
    />
  );
}

export default Input;
