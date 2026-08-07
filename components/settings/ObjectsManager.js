'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Plus, ChevronRight } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Label } from '@/components/ui/Label';
import { Icon } from '@/components/ui/Icon';
import { createObjectAction } from '@/app/(workspace)/settings/actions';

export function ObjectsManager({ objects }) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [form, setForm] = useState({ nameSingular: '', labelSingular: '', labelPlural: '' });
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
          <Button size="sm" type="submit" disabled={saving}>
            {saving ? 'Creando…' : 'Crear objeto'}
          </Button>
        </form>
      )}

      <ul className="border-border bg-surface divide-border divide-y rounded-lg border">
        {objects.map((o) => (
          <li key={o.id}>
            <Link
              href={`/settings/data-model/${o.slug}`}
              className="hover:bg-bg flex items-center gap-2 px-4 py-2.5 text-sm"
            >
              <Icon name={o.icon} size={15} className="text-secondary" />
              <span className="text-primary flex-1">{o.labelPlural}</span>
              {!o.isCustom && <span className="text-tertiary text-xs">estándar</span>}
              <ChevronRight size={15} className="text-tertiary" />
            </Link>
          </li>
        ))}
      </ul>
    </div>
  );
}

export default ObjectsManager;
