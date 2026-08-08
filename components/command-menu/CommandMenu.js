'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { Command } from 'cmdk';
import { toast } from 'sonner';
import { CheckSquare, Settings, Plus } from 'lucide-react';
import { Icon } from '@/components/ui/Icon';
import { Avatar } from '@/components/ui/Avatar';
import { searchAllAction, createRecordAction } from '@/app/(workspace)/objects/actions';

/**
 * Menú de comandos ⌘K: navegar, buscar registros y crear.
 * @param {{ open: boolean, onOpenChange: (o:boolean)=>void, objects: object[] }} props
 */
export function CommandMenu({ open, onOpenChange, objects }) {
  const router = useRouter();
  const [query, setQuery] = useState('');
  const [groups, setGroups] = useState([]);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    if (!open) setQuery('');
  }, [open]);

  useEffect(() => {
    const q = query.trim();
    if (!q) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setGroups([]);
      return;
    }
    let active = true;
    const t = setTimeout(() => {
      searchAllAction({ q }).then((r) => {
        if (active && r?.ok) setGroups(r.data);
      });
    }, 150);
    return () => {
      active = false;
      clearTimeout(t);
    };
  }, [query]);

  function go(href) {
    onOpenChange(false);
    router.push(href);
  }

  async function create(slug) {
    const r = await createRecordAction({ objectSlug: slug, data: {} });
    if (r.ok) go(`/objects/${slug}/${r.data.id}`);
    else toast.error(r.message);
  }

  const searching = query.trim().length > 0;

  return (
    <Command.Dialog
      open={open}
      onOpenChange={onOpenChange}
      label="Menú de comandos"
      shouldFilter={false}
      className="cmdk-dialog"
    >
      <Command.Input
        value={query}
        onValueChange={setQuery}
        placeholder="Buscar"
        className="border-border text-primary placeholder:text-tertiary w-full border-b bg-transparent px-4 py-3 text-sm outline-none"
      />
      <Command.List className="max-h-80 overflow-auto p-2">
        {searching && (
          <Command.Empty className="text-tertiary p-4 text-center text-sm">
            Sin resultados
          </Command.Empty>
        )}

        {!searching && (
          <>
            <Command.Group heading="Navegar" className="cmdk-group">
              {objects.map((o) => (
                <Command.Item
                  key={o.id}
                  value={`nav-${o.slug}`}
                  onSelect={() => go(`/objects/${o.slug}`)}
                  className="cmdk-item"
                >
                  <Icon name={o.icon} size={15} />
                  {o.labelPlural}
                </Command.Item>
              ))}
              <Command.Item value="nav-tasks" onSelect={() => go('/tasks')} className="cmdk-item">
                <CheckSquare size={15} />
                Tareas
              </Command.Item>
              <Command.Item
                value="nav-settings"
                onSelect={() => go('/settings/profile')}
                className="cmdk-item"
              >
                <Settings size={15} />
                Ajustes
              </Command.Item>
            </Command.Group>

            <Command.Group heading="Crear" className="cmdk-group">
              {objects.map((o) => (
                <Command.Item
                  key={`c-${o.id}`}
                  value={`create-${o.slug}`}
                  onSelect={() => create(o.slug)}
                  className="cmdk-item"
                >
                  <Plus size={15} />
                  Crear {o.labelSingular.toLowerCase()}
                </Command.Item>
              ))}
            </Command.Group>
          </>
        )}

        {searching &&
          groups.map((g) => (
            <Command.Group key={g.object.id} heading={g.object.labelPlural} className="cmdk-group">
              {g.records.map((r) => (
                <Command.Item
                  key={r.id}
                  value={`rec-${r.id}`}
                  onSelect={() => go(`/objects/${g.object.slug}/${r.id}`)}
                  className="cmdk-item"
                >
                  <Avatar name={r.label} size={18} />
                  {r.label}
                </Command.Item>
              ))}
            </Command.Group>
          ))}
      </Command.List>
    </Command.Dialog>
  );
}

export default CommandMenu;
