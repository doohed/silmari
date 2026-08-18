'use client';

import { useEffect, useRef, useState } from 'react';
import { ChevronDown, Check, Search } from 'lucide-react';
import { cn } from '@/lib/utils/cn';

/**
 * Desplegable accesible y con estética propia (no el `<select>` nativo). Con
 * búsqueda opcional para listas largas (p. ej. zonas horarias).
 * @param {{
 *   value: string,
 *   onChange: (v: string) => void,
 *   options: Array<{ value: string, label: string }>,
 *   placeholder?: string,
 *   searchable?: boolean,
 *   className?: string,
 * }} props
 */
export function Select({
  value,
  onChange,
  options,
  placeholder = 'Seleccionar',
  searchable = false,
  className,
}) {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const ref = useRef(null);

  useEffect(() => {
    if (!open) return;
    const onDoc = (e) => {
      if (ref.current && !ref.current.contains(e.target)) setOpen(false);
    };
    document.addEventListener('mousedown', onDoc);
    return () => document.removeEventListener('mousedown', onDoc);
  }, [open]);

  const selected = options.find((o) => o.value === value);
  const filtered =
    searchable && query
      ? options.filter((o) => o.label.toLowerCase().includes(query.toLowerCase()))
      : options;

  return (
    <div ref={ref} className={cn('relative', className)}>
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className="press mac-focus border-border-strong bg-surface text-primary hover:bg-sunken flex h-8 w-full items-center justify-between gap-2 rounded-lg border bg-linear-to-b from-white/12 to-transparent px-2.5 text-[13px] shadow-xs"
      >
        <span className={cn('truncate', !selected && 'text-tertiary')}>
          {selected?.label ?? placeholder}
        </span>
        <ChevronDown size={15} className="text-tertiary shrink-0" />
      </button>

      {open && (
        <div className="anim-pop mac-menu absolute top-full left-0 z-30 mt-1 max-h-64 w-full overflow-auto rounded-xl border p-1 shadow-lg">
          {searchable && (
            <div className="bg-elevated sticky top-0 flex items-center gap-2 px-2 py-1.5">
              <Search size={13} className="text-tertiary shrink-0" />
              <input
                autoFocus
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Buscar…"
                className="text-primary placeholder:text-tertiary w-full bg-transparent text-sm outline-none"
              />
            </div>
          )}
          {filtered.length === 0 && (
            <p className="text-tertiary px-2 py-2 text-xs">Sin resultados</p>
          )}
          {filtered.map((o) => (
            <button
              key={o.value}
              type="button"
              onClick={() => {
                onChange(o.value);
                setOpen(false);
                setQuery('');
              }}
              className={cn(
                'flex w-full items-center justify-between gap-2 rounded-md px-2 py-1 text-left text-[13px]',
                // Fila elegida rellena de acento, como los menús del sistema.
                o.value === value
                  ? 'bg-accent text-accent-fg'
                  : 'text-primary hover:bg-primary/[0.06]',
              )}
            >
              <span className="truncate">{o.label}</span>
              {o.value === value && <Check size={14} className="text-accent-fg shrink-0" />}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

export default Select;
