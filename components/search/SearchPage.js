'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { Icon } from '@/components/ui/Icon';
import { Input } from '@/components/ui/Input';
import { searchAllAction } from '@/app/(workspace)/objects/actions';

export function SearchPage() {
  const [q, setQ] = useState('');
  const [groups, setGroups] = useState([]);

  useEffect(() => {
    const query = q.trim();
    if (!query) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setGroups([]);
      return;
    }
    let active = true;
    const t = setTimeout(() => {
      searchAllAction({ q: query, limitPerObject: 20 }).then((r) => {
        if (active && r?.ok) setGroups(r.data);
      });
    }, 150);
    return () => {
      active = false;
      clearTimeout(t);
    };
  }, [q]);

  return (
    <div className="mx-auto w-full max-w-2xl px-6 py-8">
      <h1 className="text-primary mb-4 text-xl font-semibold tracking-tight">Buscar</h1>
      <Input
        autoFocus
        value={q}
        onChange={(e) => setQ(e.target.value)}
        placeholder="Buscar en todo…"
      />

      <div className="mt-6 space-y-5">
        {q.trim() && groups.length === 0 && <p className="text-tertiary text-sm">Sin resultados</p>}
        {groups.map((g) => (
          <section key={g.object.id}>
            <div className="text-tertiary mb-1 flex items-center gap-1.5 text-[11px] font-medium tracking-wider uppercase">
              <Icon name={g.object.icon} size={13} />
              {g.object.labelPlural}
            </div>
            <ul className="border-border bg-surface divide-border divide-y rounded-lg border">
              {g.records.map((r) => (
                <li key={r.id}>
                  <Link
                    href={`/objects/${g.object.slug}/${r.id}`}
                    className="text-primary hover:bg-bg block truncate px-3 py-2 text-sm"
                  >
                    {r.label}
                  </Link>
                </li>
              ))}
            </ul>
          </section>
        ))}
      </div>
    </div>
  );
}

export default SearchPage;
