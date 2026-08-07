import { cn } from '@/lib/utils/cn';

const COLORS = {
  gray: 'bg-chip-gray text-chip-gray-fg',
  red: 'bg-chip-red text-chip-red-fg',
  orange: 'bg-chip-orange text-chip-orange-fg',
  yellow: 'bg-chip-yellow text-chip-yellow-fg',
  green: 'bg-chip-green text-chip-green-fg',
  blue: 'bg-chip-blue text-chip-blue-fg',
  purple: 'bg-chip-purple text-chip-purple-fg',
  pink: 'bg-chip-pink text-chip-pink-fg',
};

/**
 * Chip de color reutilizable (SELECT, relaciones, tags). Misma identidad visual
 * en tabla, ficha y kanban.
 * @param {{ label: string, color?: string, className?: string }} props
 */
export function Chip({ label, color = 'gray', className }) {
  return (
    <span
      className={cn(
        'inline-flex max-w-full items-center truncate rounded px-1.5 py-0.5 text-xs font-medium',
        COLORS[color] ?? COLORS.gray,
        className,
      )}
    >
      {label}
    </span>
  );
}

export default Chip;
