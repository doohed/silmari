'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Plus, ChevronRight, Trash2 } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { SettingsGroup, SettingsRow } from '@/components/ui/SettingsGroup';
import { Icon, OBJECT_ICONS } from '@/components/ui/Icon';
import { useConfirm } from '@/components/ui/ConfirmDialog';
import { createObjectAction, deleteObjectAction } from '@/app/(workspace)/settings/actions';

const DEFAULT_ICON = 'Box';

/**
 * Lista de objetos del modelo de datos, en lista agrupada.
 *
 * El alta va en su propio grupo y se despliega al pulsar "Nuevo objeto": ocupa
 * cuatro campos y tenerla siempre abierta empujaba la lista —que es a lo que se
 * viene— fuera de la pantalla.
 */
export function ObjectsManager({ objects }) {
  const router = useRouter();
  const confirm = useConfirm();
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({
    nameSingular: '',
    labelSingular: '',
    labelPlural: '',
    icon: DEFAULT_ICON,
  });
  const [saving, setSaving] = useState(false);
  const set = (k) => (e) => setForm((f) => ({ ...f, [k]: e.target.value }));

  async function create(e) {
    e.preventDefault();
    setSaving(true);
    const r = await createObjectAction(form);
    setSaving(false);
    if (r.ok) {
      toast.success('Objeto creado');
      router.push(`/settings/data-model/${r.data.slug}`);
    } else {
      toast.error(r.message);
    }
  }

  async function remove(o) {
    const ok = await confirm({
      title: `Borrar «${o.labelPlural}»`,
      message: 'El objeto y sus campos se ocultan; sus registros dejarán de ser accesibles.',
      confirmLabel: 'Borrar',
      danger: true,
    });
    if (!ok) return;
    const r = await deleteObjectAction({ id: o.id });
    if (r.ok) {
      toast.success('Objeto borrado');
      router.refresh();
    } else {
      toast.error(r.message);
    }
  }

  return (
    <div>
      <SettingsGroup footnote="Cada objeto tiene sus propios campos, su tabla y su kanban. Los estándar no se pueden borrar.">
        <SettingsRow
          label="Nuevo objeto"
          hint="Un tipo de ficha: productos, contratos, incidencias…"
        >
          <Button
            size="md"
            variant={open ? 'secondary' : 'primary'}
            onClick={() => setOpen((o) => !o)}
          >
            <Plus size={14} /> {open ? 'Cancelar' : 'Crear'}
          </Button>
        </SettingsRow>

        {open && (
          <>
            <SettingsRow label="Nombre técnico" hint="camelCase; es el que usa la API">
              <Input
                aria-label="Nombre técnico"
                value={form.nameSingular}
                onChange={set('nameSingular')}
                placeholder="producto"
                className="w-56"
              />
            </SettingsRow>
            <SettingsRow label="Etiqueta singular">
              <Input
                aria-label="Etiqueta singular"
                value={form.labelSingular}
                onChange={set('labelSingular')}
                placeholder="Producto"
                className="w-56"
              />
            </SettingsRow>
            <SettingsRow label="Etiqueta plural">
              <Input
                aria-label="Etiqueta plural"
                value={form.labelPlural}
                onChange={set('labelPlural')}
                placeholder="Productos"
                className="w-56"
              />
            </SettingsRow>
            <SettingsRow stacked label="Icono">
              <div className="flex flex-wrap gap-1.5">
                {OBJECT_ICONS.map((name) => (
                  <button
                    key={name}
                    type="button"
                    onClick={() => setForm((f) => ({ ...f, icon: name }))}
                    aria-label={name}
                    aria-pressed={form.icon === name}
                    className={
                      form.icon === name
                        ? 'border-accent bg-accent-subtle text-accent flex size-8 items-center justify-center rounded-md border'
                        : 'border-border text-secondary hover:bg-chip-gray hover:text-primary flex size-8 items-center justify-center rounded-md border'
                    }
                  >
                    <Icon name={name} size={15} />
                  </button>
                ))}
              </div>
            </SettingsRow>
            <SettingsRow label="Crear el objeto">
              <Button size="md" onClick={create} disabled={saving || !form.nameSingular.trim()}>
                {saving ? 'Creando…' : 'Crear objeto'}
              </Button>
            </SettingsRow>
          </>
        )}
      </SettingsGroup>

      <SettingsGroup title="Objetos">
        {objects.map((o) => (
          <SettingsRow
            key={o.id}
            label={o.labelPlural}
            icon={<Icon name={o.icon} size={15} />}
            className="hover:bg-sunken relative"
          >
            <div className="flex items-center gap-3">
              {o.isCustom ? (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => remove(o)}
                  aria-label={`Borrar ${o.labelPlural}`}
                  className="hover:text-danger relative z-10"
                >
                  <Trash2 size={14} />
                </Button>
              ) : (
                <span className="text-tertiary text-xs">Estándar</span>
              )}
              <ChevronRight size={15} className="text-tertiary" aria-hidden />
            </div>
            {/* Enlace en toda la fila: en una lista agrupada se pulsa la fila
                entera, no solo el texto. Va por encima con `absolute` para no
                envolver los botones, que tienen su propia acción. */}
            <Link
              href={`/settings/data-model/${o.slug}`}
              className="absolute inset-0"
              aria-label={o.labelPlural}
            />
          </SettingsRow>
        ))}
      </SettingsGroup>
    </div>
  );
}

export default ObjectsManager;
