import { cn } from '@/lib/utils/cn';

/**
 * Lista agrupada al estilo de Ajustes del Sistema de macOS: una caja blanca
 * sobre el fondo gris, con las filas separadas por hairlines que **no llegan al
 * borde izquierdo**, y el control alineado a la derecha de su etiqueta.
 *
 * Es el patrón que más define esa estética, más que los radios o las sombras:
 * el contenido se lee como una lista de ajustes, no como un formulario suelto.
 *
 * Uso:
 *   <SettingsGroup title="Apariencia">
 *     <SettingsRow label="Tema" hint="Claro u oscuro">
 *       <ThemeToggle />
 *     </SettingsRow>
 *   </SettingsGroup>
 *
 * @param {{ title?: string, footnote?: string, children: import('react').ReactNode, className?: string }} props
 */
export function SettingsGroup({ title, footnote, children, className }) {
  return (
    <section className={cn('mb-6', className)}>
      {title && <h2 className="text-secondary mb-2 px-1 text-[13px] font-medium">{title}</h2>}
      {/* `overflow-hidden` recorta la primera y la última fila contra el radio:
        sin él, el fondo de una fila al pasar el ratón asoma por las esquinas. */}
      <div className="border-border bg-surface overflow-hidden rounded-xl border shadow-xs">
        {children}
      </div>
      {footnote && <p className="text-tertiary mt-2 px-1 text-xs">{footnote}</p>}
    </section>
  );
}

/**
 * Fila de una lista agrupada: etiqueta (y pista opcional) a la izquierda, el
 * control a la derecha.
 *
 * El separador va como `border-t` en todas menos la primera, en vez de
 * `divide-y` en el padre, para que se pueda insertar una fila condicional sin
 * que el borde salte de sitio.
 *
 * @param {{
 *   label: string,
 *   hint?: string,
 *   children?: import('react').ReactNode,
 *   stacked?: boolean,  el control debajo, para contenidos anchos
 *   className?: string,
 * }} props
 */
export function SettingsRow({ label, hint, children, stacked = false, className }) {
  return (
    <div
      className={cn(
        // El separador arranca a 16 px del canto (`ml-4` vía borde en un
        // pseudo-hijo no; aquí basta con el padding del contenedor padre), que
        // es lo que distingue una lista agrupada de una tabla.
        'border-border px-4 py-2.5 first:border-t-0 [&:not(:first-child)]:border-t',
        stacked ? 'space-y-2' : 'flex items-center justify-between gap-4',
        className,
      )}
    >
      <div className="min-w-0">
        <p className="text-primary text-[13px]">{label}</p>
        {hint && <p className="text-tertiary mt-0.5 text-xs">{hint}</p>}
      </div>
      {children && <div className={stacked ? '' : 'shrink-0'}>{children}</div>}
    </div>
  );
}

export default SettingsGroup;
