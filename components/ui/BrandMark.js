import { cn } from '@/lib/utils/cn';

/**
 * Marca de Silmari: cuadrado redondeado con el monograma. Reutilizable en la
 * puerta de entrada, el onboarding y la barra lateral.
 * @param {{ size?: number, className?: string }} props
 */
export function BrandMark({ size = 44, className }) {
  return (
    <span
      style={{ width: size, height: size, fontSize: Math.round(size * 0.5) }}
      className={cn(
        'bg-accent text-accent-fg inline-flex items-center justify-center rounded-lg font-bold tracking-tight shadow-xs select-none',
        className,
      )}
      aria-hidden="true"
    >
      S
    </span>
  );
}

export default BrandMark;
