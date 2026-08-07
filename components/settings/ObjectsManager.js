'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Plus, ChevronRight, Trash2 } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Label } from '@/components/ui/Label';
import { Icon, OBJECT_ICONS } from '@/components/ui/Icon';
import { useConfirm } from '@/components/ui/ConfirmDialog';
import { createObjectAction, deleteObjectAction } from '@/app/(workspace)/settings/actions';

const DEFAULT_ICON = 'Box';

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
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-primary text-sm font-semibold">Objetos</h2>
        <Button size="sm" onClick={() => setOpen((o) => !o)}>
          <Plus size={14} /> Nuevo objeto
        </Button>
      </div>

      {open && (
        <form onSubmit={create} className="border-border bg-bg space-y-3 rounded-lg border p-4">
          <div className="grid grid-cols-2 gap-3">
            <div>
              <Label htmlFor="nameSingular">Nombre técnico (camelCase)</Label>
              <Input
                id="nameSingular"
                value={form.nameSingular}
                onChange={set('nameSingular')}
                placeholder="producto"
              />
            </div>
            <div>
              <Label htmlFor="labelSingular">Etiqueta singular</Label>
              <Input
                id="labelSingular"
                value={form.labelSingular}
                onChange={set('labelSingular')}
                placeholder="Producto"
              />
            </div>
          </div>
          <div>
            <Label htmlFor="labelPlural">Etiqueta plural</Label>
            <Input
              id="labelPlural"
              value={form.labelPlural}
              onChange={set('labelPlural')}
              placeholder="Productos"
            />
          </div>

          <div>
            <Label>Icono</Label>
            <div className="mt-1 flex flex-wrap gap-1.5">
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
          </div>

          <Button size="sm" type="submit" disabled={saving}>
            {saving ? 'Creando…' : 'Crear objeto'}
          </Button>
        </form>
      )}

      <ul className="border-border bg-surface divide-border divide-y rounded-lg border">
        {objects.map((o) => (
          <li key={o.id} className="hover:bg-bg flex items-center gap-2 px-4 py-2.5">
            <Link
              href={`/settings/data-model/${o.slug}`}
              className="flex min-w-0 flex-1 items-center gap-2 text-sm"
            >
              <Icon name={o.icon} size={15} className="text-secondary shrink-0" />
              <span className="text-primary truncate">{o.labelPlural}</span>
            </Link>
            {o.isCustom ? (
              <button
                type="button"
                onClick={() => remove(o)}
                className="text-tertiary hover:text-danger shrink-0"
                aria-label="Borrar objeto"
                title="Borrar objeto"
              >
                <Trash2 size={14} />
              </button>
            ) : (
              <span className="text-tertiary shrink-0 text-xs">estándar</span>
            )}
            <ChevronRight size={15} className="text-tertiary shrink-0" />
          </li>
        ))}
      </ul>
    </div>
  );
}

export default ObjectsManager;
