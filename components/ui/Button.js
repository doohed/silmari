import { cn } from '@/lib/utils/cn';

const VARIANTS = {
  primary:
    'bg-accent text-accent-fg shadow-xs hover:bg-accent/90 disabled:opacity-50 disabled:cursor-not-allowed disabled:shadow-none',
  secondary:
    'bg-surface text-primary border border-border hover:bg-chip-gray/60 hover:border-border-strong disabled:opacity-50',
  ghost: 'text-secondary hover:bg-chip-gray hover:text-primary disabled:opacity-50',
  danger: 'bg-danger text-white shadow-xs hover:opacity-90 disabled:opacity-50',
};

const SIZES = {
  sm: 'h-8 gap-1.5 px-3 text-xs',
  md: 'h-9 px-4 text-[13px]',
};

/**
 * Botón base del sistema de diseño.
 * @param {object} props
 * @param {keyof typeof VARIANTS} [props.variant]
 * @param {keyof typeof SIZES} [props.size]
 * @param {string} [props.className]
 */
export function Button({ variant = 'primary', size = 'md', className, ...props }) {
  return (
    <button
      className={cn(
        'press inline-flex items-center justify-center gap-2 rounded-md font-medium',
        'focus-visible:ring-accent/40 focus-visible:ring-2 focus-visible:outline-none',
        VARIANTS[variant],
        SIZES[size],
        className,
      )}
      {...props}
    />
  );
}

export default Button;
