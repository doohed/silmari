import { cn } from '@/lib/utils/cn';

/* Los botones de macOS tienen un brillo muy tenue arriba (el degradado del
   material) y una sombra corta que los despega del fondo. Se consigue con un
   `linear-gradient` de blanco casi transparente encima del color, no con un
   color distinto: así vale igual para el acento, el rojo o el gris.
   El valor vive en el token `--gloss` (`globals.css`), que en **oscuro es
   `transparent`**: la misma veladura que da relieve sobre un fondo claro, sobre
   uno oscuro se lee como una rampa y el control parece un degradado. */
const GLOSS = 'mac-gloss';

const VARIANTS = {
  primary: `bg-accent ${GLOSS} text-accent-fg shadow-sm hover:brightness-105 active:brightness-95 disabled:opacity-50 disabled:cursor-not-allowed disabled:shadow-none`,
  secondary: `bg-surface ${GLOSS} text-primary border-border shadow-xs hover:bg-sunken border disabled:opacity-50`,
  ghost: 'text-secondary hover:bg-primary/[0.06] hover:text-primary disabled:opacity-50',
  danger: `bg-danger ${GLOSS} text-white shadow-sm hover:brightness-110 disabled:opacity-50`,
};

const SIZES = {
  sm: 'h-7 gap-1.5 rounded-md px-2.5 text-xs',
  md: 'h-8 rounded-lg px-3.5 text-[13px]',
  lg: 'h-10 rounded-lg px-5 text-sm',
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
        'press mac-focus inline-flex items-center justify-center gap-2 font-medium',
        VARIANTS[variant],
        SIZES[size],
        className,
      )}
      {...props}
    />
  );
}

export default Button;
