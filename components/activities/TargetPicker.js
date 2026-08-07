'use client';

import { useEffect, useState } from 'react';
import { listObjectsAction, searchRecordsAction } from '@/app/(workspace)/objects/actions';

/**
 * Selector para vincular la actividad a otro registro: elige objeto y busca.
 * @param {{ onAdd: (t:{objectMetadataId:string, recordId:string, label:string, slug:string})=>void }} props
 */
export function TargetPicker({ onAdd }) {
  const [objects, setObjects] = useState([]);
  const [slug, setSlug] = useState('');
  const [q, setQ] = useState('');
  const [opts, setOpts] = useState([]);

  useEffect(() => {
    listObjectsAction().then((r) => {
      if (r?.ok) {
        setObjects(r.data);
        // Default solo si el usuario aún no ha elegido (evita pisar su selección
        // si el fetch de objetos resuelve tarde).
        if (r.data[0]) setSlug((prev) => prev || r.data[0].slug);
      }
    });
  }, []);

  useEffect(() => {
    if (!slug) return;
    let active = true;
    searchRecordsAction({ objectSlug: slug, q }).then((r) => {
      if (active && r?.ok) setOpts(r.data);
    });
    return () => {
      active = false;
    };
  }, [slug, q]);

  const currentObject = objects.find((o) => o.slug === slug);

  return (
    <div className="border-border bg-elevated rounded-md border p-2">
      <div className="mb-1 flex gap-1">
        <select
          value={slug}
          onChange={(e) => setSlug(e.target.value)}
          className="border-border bg-surface h-8 rounded-md border px-2 text-xs"
        >
          {objects.map((o) => (
            <option key={o.id} value={o.slug}>
              {o.labelSingular}
            </option>
          ))}
        </select>
        <input
          value={q}
          onChange={(e) => setQ(e.target.value)}
          placeholder="Buscar…"
          className="border-border bg-surface h-8 flex-1 rounded-md border px-2 text-xs outline-none"
        />
      </div>
      <ul className="max-h-40 overflow-auto">
        {opts.length === 0 && <li className="text-tertiary px-2 py-1 text-xs">Sin resultados</li>}
        {opts.map((o) => (
          <li key={o.id}>
            <button
              type="button"
              onClick={() =>
                onAdd({
                  objectMetadataId: currentObject.id,
                  recordId: o.id,
                  label: o.label,
                  slug,
                })
              }
              className="hover:bg-chip-gray w-full rounded px-2 py-1 text-left text-sm"
            >
              {o.label}
            </button>
          </li>
        ))}
      </ul>
    </div>
  );
}

export default TargetPicker;
