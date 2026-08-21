'use client';

import { useEffect } from 'react';
import { AreaChart, BarChart3, BarChartHorizontal, Check, Hash, PieChart } from 'lucide-react';
import { WIDGETS } from '@/lib/dashboards/catalog';

/** Icono del menú según el gráfico que dibuja el widget. */
const KIND_ICON = {
  stat: Hash,
  bar: BarChart3,
  hbar: BarChartHorizontal,
  donut: PieChart,
  area: AreaChart,
};

/* Dos grupos, como los menús del sistema: las cifras sueltas arriba (son
   tarjetas de 1×1) y los gráficos debajo. Sin separarlos, diez entradas
   seguidas obligan a leerlas una a una para saber cuál ocupa media fila. */
const GROUPS = [
  { label: 'Cifras', items: WIDGETS.filter((w) => w.kind === 'stat') },
  { label: 'Gráficos', items: WIDGETS.filter((w) => w.kind !== 'stat') },
];

/**
 * Menú de «Añadir widget». Marca con un check los que ya están en el panel,
 * pero **no los deshabilita**: repetir un widget en dos tamaños distintos es un
 * uso legítimo del lienzo.
 * @param {{
 *   existing: Array<{ type: string }>,
 *   onAdd: (type: string) => void,
 *   onClose: () => void,
 * }} props
 */
export function AddWidgetMenu({ existing, onAdd, onClose }) {
  useEffect(() => {
    const onKey = (e) => {
      if (e.key === 'Escape') onClose();
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [onClose]);

  const used = new Set((existing ?? []).map((w) => w.type));

  return (
    <>
      {/* Capa invisible para cerrar al clic fuera: el mismo recurso que usa el
        resto de popovers propios de la app. */}
      <div className="fixed inset-0 z-30" onClick={onClose} />
      <div
        role="menu"
        className="anim-pop mac-menu absolute top-full right-0 z-40 mt-1 max-h-[26rem] w-72 overflow-auto p-1"
      >
        {GROUPS.map((g, gi) => (
          <div key={g.label} className={gi > 0 ? 'border-border mt-1 border-t pt-1' : undefined}>
            <p className="text-tertiary px-2 pt-1 pb-0.5 text-[11px] font-medium">{g.label}</p>
            {g.items.map((w) => {
              const Icon = KIND_ICON[w.kind] ?? Hash;
              return (
                <button
                  key={w.type}
                  type="button"
                  role="menuitem"
                  onClick={() => onAdd(w.type)}
                  className="hover:bg-accent hover:text-accent-fg text-primary group flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-left text-[13px]"
                >
                  <Icon size={14} className="text-tertiary group-hover:text-accent-fg shrink-0" />
                  <span className="min-w-0 flex-1 truncate">{w.title}</span>
                  {used.has(w.type) && (
                    <Check
                      size={13}
                      className="text-tertiary group-hover:text-accent-fg shrink-0"
                      aria-label="Ya está en el panel"
                    />
                  )}
                </button>
              );
            })}
          </div>
        ))}
      </div>
    </>
  );
}

export default AddWidgetMenu;
