import { cn } from '@/lib/utils/cn';

const PALETTE = ['blue', 'green', 'purple', 'orange', 'pink', 'red', 'yellow', 'gray'];

function initials(name) {
  const parts = String(name ?? '')
    .trim()
    .split(/\s+/)
    .filter(Boolean);
  if (parts.length === 0) return '·';
  return (parts[0][0] + (parts[1]?.[0] ?? '')).toUpperCase();
}

function colorFor(name) {
  let h = 0;
  for (const ch of String(name ?? '')) h = (h * 31 + ch.charCodeAt(0)) >>> 0;
  return PALETTE[h % PALETTE.length];
}

const CLASS = {
  blue: 'bg-chip-blue text-chip-blue-fg',
  green: 'bg-chip-green text-chip-green-fg',
  purple: 'bg-chip-purple text-chip-purple-fg',
  orange: 'bg-chip-orange text-chip-orange-fg',
  pink: 'bg-chip-pink text-chip-pink-fg',
  red: 'bg-chip-red text-chip-red-fg',
  yellow: 'bg-chip-yellow text-chip-yellow-fg',
  gray: 'bg-chip-gray text-chip-gray-fg',
};

/**
 * Avatar con iniciales y color derivado del nombre (estable). Si se pasa `src`
 * (data URL o URL remota) muestra la imagen. Identidad visual consistente para
 * personas, usuarios, registros y workspaces.
 * @param {{ name?: string, src?: string|null, size?: number, className?: string, rounded?: 'full'|'xl' }} props
 */
export function Avatar({ name, src, size = 22, className, rounded = 'full' }) {
  const shape = rounded === 'xl' ? 'rounded-xl' : 'rounded-full';
  if (src) {
    return (
      // eslint-disable-next-line @next/next/no-img-element
      <img
        src={src}
        alt=""
        width={size}
        height={size}
        style={{ width: size, height: size }}
        className={cn('shrink-0 object-cover select-none', shape, className)}
        aria-hidden="true"
      />
    );
  }
  return (
    <span
      style={{ width: size, height: size, fontSize: Math.round(size * 0.42) }}
      className={cn(
        'inline-flex shrink-0 items-center justify-center font-medium select-none',
        shape,
        CLASS[colorFor(name)],
        className,
      )}
      aria-hidden="true"
    >
      {initials(name)}
    </span>
  );
}

export default Avatar;
