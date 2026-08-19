'use client';

import { useCallback, useRef, useState } from 'react';
import * as Dialog from '@radix-ui/react-dialog';
import { useRouter } from 'next/navigation';
import { X } from 'lucide-react';
import { NavItem } from '@/components/layout/NavItem';

/** Lo que dura la animación de salida (`.settings-window[data-closing]`). */
const CLOSE_MS = 170;

/**
 * Ajustes como VENTANA flotante, no como página a pantalla completa: el resto
 * de la app se queda detrás, difuminada, para que se lea como algo que se abre
 * encima y se cierra, igual que Ajustes del Sistema en macOS.
 *
 * Es un diálogo de Radix (siempre abierto) por lo que trae de serie: foco
 * atrapado dentro de la tarjeta, Escape y clic fuera para cerrar. Al cerrar
 * navegamos a la portada en vez de `router.back()`: moverse entre secciones
 * apila entradas de historial, así que "atrás" devolvería a la sección anterior
 * de Ajustes en lugar de sacar de Ajustes.
 *
 * La tarjeta mide **lo mismo en todas las secciones** (alto y ancho fijos): es
 * una ventana, y una ventana que se encoge al cambiar de sección se lee como un
 * salto. El contenido más largo scrollea dentro.
 *
 * @param {{ groups: { title: string, items: { href: string, label: string, icon?: string }[] }[], children: React.ReactNode }} props
 */
export function SettingsShell({ groups, children }) {
  const router = useRouter();
  const [closing, setClosing] = useState(false);
  const closingRef = useRef(false);

  // El diálogo no se desmonta al cerrar: se navega fuera de /settings. Así que
  // marcamos la salida, dejamos que se vea, y navegamos al terminar.
  const close = useCallback(() => {
    if (closingRef.current) return;
    closingRef.current = true;
    setClosing(true);
    window.setTimeout(() => router.push('/'), CLOSE_MS);
  }, [router]);

  const closingAttr = closing ? 'true' : undefined;

  return (
    <Dialog.Root
      open
      onOpenChange={(open) => {
        if (!open) close();
      }}
    >
      <Dialog.Portal>
        {/* El difuminado va en el velo, no en la tarjeta: un `backdrop-filter`
          en la tarjeta crearía un backdrop root y los menús que cuelgan de
          dentro dejarían de filtrar. */}
        <Dialog.Overlay data-closing={closingAttr} className="settings-scrim fixed inset-0 z-40" />
        {/* Sin autofoco al abrir: el primer elemento enfocable es la X y Radix le
          dejaba el halo de foco puesto nada más entrar, como si algo estuviera
          seleccionado. El diálogo sigue atrapando el tabulador y Escape, que
          Radix escucha en el documento. */}
        {/* El centrado (fixed + top/left 50% + translate) lo pone `.settings-window`
          en CSS, no las utilidades de Tailwind, y por eso el keyframe lo repite:
          Tailwind v4 compila `-translate-x-1/2` a la propiedad **`translate`**,
          que se compone con el `transform` que anima la entrada y desplazaba la
          tarjeta el doble mientras duraba (en Safari se veía entrando pegada a
          la esquina superior izquierda). Con el centrado dentro del mismo
          `transform` no hay dos fuentes que se sumen. */}
        <Dialog.Content
          data-closing={closingAttr}
          onOpenAutoFocus={(e) => e.preventDefault()}
          className="settings-window mac-menu z-40 flex h-[min(46rem,90vh)] w-[min(62rem,95vw)] flex-col overflow-hidden md:flex-row"
        >
          <Dialog.Title className="sr-only">Ajustes</Dialog.Title>

          {/* Navegación: columna a la izquierda en escritorio; en móvil, una
            tira horizontal arriba, que 224 px de columna se comen la tarjeta. */}
          <aside className="border-border bg-sunken/60 hidden w-56 shrink-0 overflow-y-auto border-r p-3 md:block">
            <p className="text-primary mb-2 px-2 text-[15px] font-semibold tracking-tight">
              Ajustes
            </p>
            <nav>
              {groups.map((g) => (
                <div key={g.title} className="mb-3 last:mb-0">
                  <p className="text-tertiary px-2 pb-1 text-[11px] font-medium tracking-wider uppercase">
                    {g.title}
                  </p>
                  <div className="space-y-px">
                    {g.items.map((s) => (
                      <NavItem key={s.href} href={s.href} label={s.label} icon={s.icon} />
                    ))}
                  </div>
                </div>
              ))}
            </nav>
          </aside>

          <nav className="border-border bg-sunken/60 flex shrink-0 gap-1 overflow-x-auto border-b p-2 md:hidden">
            {groups.flatMap((g) =>
              g.items.map((s) => (
                <span key={s.href} className="shrink-0">
                  <NavItem href={s.href} label={s.label} icon={s.icon} />
                </span>
              )),
            )}
          </nav>

          <div className="relative min-h-0 min-w-0 flex-1">
            <Dialog.Close
              aria-label="Cerrar ajustes"
              className="press mac-focus text-tertiary hover:bg-primary/[0.06] hover:text-primary absolute top-3 right-3 z-10 flex size-7 items-center justify-center rounded-lg"
            >
              <X size={16} />
            </Dialog.Close>
            {/* `scrollbar-gutter: stable` reserva el carril del scroll siempre:
              sin él, las secciones cortas (Miembros) y las largas (Perfil) dan
              anchos útiles distintos y el contenido centrado se desplaza unos
              píxeles al cambiar de sección en los sistemas con barra clásica. */}
            <div className="h-full [scrollbar-gutter:stable] overflow-y-auto">{children}</div>
          </div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}

export default SettingsShell;
