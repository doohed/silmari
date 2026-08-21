'use client';

import { useRef, useState, useTransition } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { DndContext, closestCenter, PointerSensor, useSensor, useSensors } from '@dnd-kit/core';
import { SortableContext, rectSortingStrategy, arrayMove } from '@dnd-kit/sortable';
import { ArrowLeft, Check, LayoutGrid, Pencil, Plus } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/Button';
import { Avatar } from '@/components/ui/Avatar';
import { defaultSizeFor, nextSize } from '@/lib/dashboards/catalog';
import {
  createDashboardAction,
  updateDashboardWidgetsAction,
  renameDashboardAction,
} from '@/app/(workspace)/dashboards/actions';
import { WidgetCard } from './WidgetCard';
import { AddWidgetMenu } from './AddWidgetMenu';

/* El mismo botón de icono que la cabecera de la ficha (`RecordHeader`): las dos
   barras de `h-12` se ven en la misma sesión y un «volver» de otro tamaño se
   nota enseguida. */
const HEADER_ICON_BTN =
  'text-tertiary hover:bg-chip-gray hover:text-primary flex size-7 shrink-0 items-center justify-center rounded-md transition-colors';

/**
 * Detalle de un panel, con la misma anatomía que una ficha de registro: barra de
 * ventana de `h-12` (volver + nombre editable + recuento + acciones), **banda de
 * títulos** de `.mac-list-head` con los paneles hermanos como pestañas, y debajo
 * el lienzo de widgets.
 *
 * Que el nombre salga a la vez en la barra y en la pestaña activa no es una
 * repetición: es el reparto de una ventana con pestañas del sistema —el título
 * dice dónde estás (y ahí se renombra), las pestañas son solo navegación.
 *
 * En modo edición se pueden añadir, quitar, redimensionar y reordenar widgets;
 * cada cambio se guarda al momento.
 *
 * @param {{
 *   dashboard: { id:string, name:string, widgets: Array<{id:string,type:string,w:number,h:number}> },
 *   panels: Array<{ id:string, name:string }>,
 *   metrics: object,
 * }} props
 */
export function DashboardView({ dashboard, panels, metrics }) {
  const router = useRouter();
  const [widgets, setWidgets] = useState(dashboard.widgets);
  const [name, setName] = useState(dashboard.name);
  const [editing, setEditing] = useState(false);
  const [adding, setAdding] = useState(false);
  const [renaming, setRenaming] = useState(false);
  const [pending, startTransition] = useTransition();
  const renameRef = useRef(null);

  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 5 } }));

  async function persist(next) {
    setWidgets(next);
    const r = await updateDashboardWidgetsAction({ id: dashboard.id, widgets: next });
    if (!r.ok) toast.error(r.message || 'No se pudo guardar el panel');
  }

  function onDragEnd({ active, over }) {
    if (!over || active.id === over.id) return;
    const from = widgets.findIndex((w) => w.id === active.id);
    const to = widgets.findIndex((w) => w.id === over.id);
    if (from < 0 || to < 0) return;
    persist(arrayMove(widgets, from, to));
  }

  const add = (type) => {
    persist([...widgets, { id: crypto.randomUUID(), type, ...defaultSizeFor(type) }]);
    setAdding(false);
  };
  const remove = (id) => persist(widgets.filter((w) => w.id !== id));
  const resize = (id) =>
    persist(widgets.map((w) => (w.id === id ? { ...w, ...nextSize({ w: w.w, h: w.h }) } : w)));

  const submitRename = () => {
    const next = (renameRef.current?.value ?? '').trim();
    setRenaming(false);
    if (!next || next === name) return;
    setName(next);
    startTransition(async () => {
      const r = await renameDashboardAction({ id: dashboard.id, name: next });
      if (!r.ok) {
        setName(dashboard.name);
        return toast.error(r.message || 'No se pudo renombrar');
      }
      router.refresh();
    });
  };

  const createPanel = () =>
    startTransition(async () => {
      const r = await createDashboardAction({ name: `Panel ${(panels?.length ?? 0) + 1}` });
      if (!r.ok) return toast.error(r.message || 'No se pudo crear el panel');
      router.push(`/dashboards/${r.data.id}`);
      router.refresh();
    });

  /** Entra en edición y abre el menú: el atajo del estado vacío. */
  const startAdding = () => {
    setEditing(true);
    setAdding(true);
  };

  return (
    <div className="flex h-full flex-col">
      {/* Barra de ventana. `h-12` y `px-3` como `RecordViewBar` y `RecordHeader`:
        las barras superiores de la app cierran todas en la misma línea.
        `relative z-40` para que el menú de «Añadir widget» caiga por encima del
        lienzo en vez de partirse contra él. */}
      <header className="border-border relative z-40 flex h-12 shrink-0 items-center gap-2 border-b px-3">
        <Link href="/dashboards" className={HEADER_ICON_BTN} aria-label="Volver a paneles">
          <ArrowLeft size={16} />
        </Link>
        <Avatar name={name} size={20} className="ml-0.5 shrink-0" />

        <div className="flex min-w-0 flex-1 items-center gap-2">
          {renaming ? (
            <input
              ref={renameRef}
              defaultValue={name}
              autoFocus
              maxLength={60}
              disabled={pending}
              onBlur={submitRename}
              onKeyDown={(e) => {
                if (e.key === 'Enter') submitRename();
                if (e.key === 'Escape') setRenaming(false);
              }}
              className="bg-elevated text-primary ring-accent h-7 min-w-0 flex-1 rounded-md px-2 text-[13px] font-semibold ring-2 outline-none ring-inset"
              aria-label="Nombre del panel"
            />
          ) : (
            <button
              type="button"
              onClick={() => setRenaming(true)}
              title="Clic para renombrar"
              className="hover:bg-chip-gray/60 text-primary flex h-7 min-w-0 items-center rounded-md px-2 text-[13px] font-semibold"
            >
              <span className="truncate">{name}</span>
            </button>
          )}
          {/* El recuento en terciario y tabular, igual que el de la lista de
            paneles y el de la barra de vistas. */}
          <span className="text-tertiary shrink-0 text-xs tabular-nums">{widgets.length}</span>
        </div>

        <div className="relative flex shrink-0 items-center gap-1">
          {editing && (
            <Button size="sm" variant="ghost" onClick={() => setAdding((a) => !a)}>
              <Plus size={14} /> Añadir widget
            </Button>
          )}
          <Button
            size="sm"
            variant={editing ? 'primary' : 'secondary'}
            onClick={() => {
              setEditing((e) => !e);
              setAdding(false);
            }}
          >
            {editing ? <Check size={14} /> : <Pencil size={14} />} {editing ? 'Hecho' : 'Editar'}
          </Button>
          {adding && (
            <AddWidgetMenu existing={widgets} onAdd={add} onClose={() => setAdding(false)} />
          )}
        </div>
      </header>

      {/* Banda de títulos con los paneles del workspace como pestañas: la misma
        clase, la misma altura y la misma pastilla en relieve que las pestañas de
        la ficha. El «+» va FUERA del carril con scroll para que no se lo lleve
        el desplazamiento cuando hay muchos paneles. */}
      <nav
        aria-label="Paneles"
        className="mac-list-head flex shrink-0 items-center gap-1 pr-1.5 pl-1"
      >
        <div className="flex min-w-0 flex-1 items-center gap-0.5 overflow-x-auto px-1">
          {(panels ?? []).map((p) => {
            const isActive = p.id === dashboard.id;
            return (
              <Link
                key={p.id}
                href={`/dashboards/${p.id}`}
                data-active={isActive}
                aria-current={isActive ? 'page' : undefined}
                className="mac-tab flex shrink-0 items-center px-2.5 text-[11.5px] font-medium whitespace-nowrap"
                title={p.name}
              >
                {isActive ? name : p.name}
              </Link>
            );
          })}
        </div>
        <button
          type="button"
          onClick={createPanel}
          disabled={pending}
          className="mac-tab flex size-[22px] shrink-0 items-center justify-center disabled:opacity-50"
          aria-label="Nuevo panel"
          title="Nuevo panel"
        >
          <Plus size={13} />
        </button>
      </nav>

      {/* Lienzo con su propio suelo (`--canvas`), no la lámina blanca: unas
        tarjetas blancas con borde sobre blanco no se leen como tarjetas, se leen
        como recuadros. Pero tampoco `--bg`: el rail lateral es ese mismo gris y
        se ve justo al lado, así que la lámina desaparecía y el panel parecía un
        hueco recortado en la ventana. `--canvas` queda ENTRE la tarjeta y el
        fondo de la ventana en los dos temas (por eso no vale `--sunken`, que en
        oscuro es más claro que `--surface`). */}
      <div className="bg-canvas min-h-0 flex-1 overflow-auto p-4">
        {widgets.length === 0 ? (
          <EmptyCanvas onAdd={startAdding} />
        ) : (
          <DndContext
            id="dashboard-view-dnd"
            sensors={sensors}
            collisionDetection={closestCenter}
            onDragEnd={onDragEnd}
          >
            <SortableContext items={widgets.map((w) => w.id)} strategy={rectSortingStrategy}>
              <div className="grid grid-flow-dense auto-rows-[7.5rem] grid-cols-2 gap-3 md:grid-cols-4 md:gap-4">
                {widgets.map((w) => (
                  <WidgetCard
                    key={w.id}
                    widget={w}
                    metrics={metrics}
                    editing={editing}
                    onRemove={() => remove(w.id)}
                    onResize={() => resize(w.id)}
                  />
                ))}
              </div>
            </SortableContext>
          </DndContext>
        )}
      </div>
    </div>
  );
}

/**
 * Lienzo vacío. Mismo esqueleto que el estado vacío de la tabla de registros
 * (tesela de acento, título, una línea de ayuda y la acción), para que la app
 * no tenga dos maneras de decir «aquí todavía no hay nada».
 */
function EmptyCanvas({ onAdd }) {
  return (
    <div className="anim-fade-up flex h-full flex-col items-center justify-center gap-3 p-10 text-center">
      <div className="bg-accent-subtle text-accent mb-1 flex size-14 items-center justify-center rounded-2xl shadow-sm">
        <LayoutGrid size={24} />
      </div>
      <p className="text-primary text-base font-medium">Este panel está vacío</p>
      <p className="text-secondary max-w-xs text-xs">
        Añade widgets para seguir el pipeline, las oportunidades por etapa o el valor cerrado por
        mes.
      </p>
      <Button size="sm" onClick={onAdd}>
        <Plus size={14} /> Añadir widget
      </Button>
    </div>
  );
}

export default DashboardView;
