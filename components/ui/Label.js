import { cn } from '@/lib/utils/cn';

/**
 * Etiqueta de formulario.
 * @param {object} props
 * @param {string} [props.className]
 */
export function Label({ className, ...props }) {
  return (
    <label
      className={cn('text-secondary mb-1.5 block text-xs font-medium', className)}
      {...props}
    />
  );
}

export default Label;
