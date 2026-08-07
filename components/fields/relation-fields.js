'use client';

import { useEffect, useState } from 'react';
import { Chip } from './Chip';
import { cellInputClass } from './cell-keys';
import { searchRelationOptionsAction } from '@/app/(workspace)/objects/actions';

const empty = <span className="text-tertiary">—</span>;

/** Display recibe la relación hidratada `{ id, label }` (la pasa la tabla). */
function RelationDisplay({ relation }) {
  return relation?.label ? <Chip label={relation.label} color="blue" /> : empty;
}

function RelationEdit({ field, onCommit, onCancel }) {
  const [q, setQ] = useState('');
  const [opts, setOpts] = useState([]);

  useEffect(() => {
    let active = true;
    searchRelationOptionsAction({ fieldMetadataId: field.id, q }).then((r) => {
      if (active && r?.ok) setOpts(r.data);
    });
    return () => {
      active = false;
    };
  }, [q, field.id]);

  return (
    <div className="relative h-full w-full">
      <input
        autoFocus
        className={cellInputClass}
        value={q}
        placeholder="Buscar…"
        onChange={(e) => setQ(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === 'Escape') {
            e.preventDefault();
            onCancel();
          }
        }}
      />
      <div className="border-border bg-elevated absolute top-full left-0 z-20 mt-1 max-h-60 w-64 overflow-auto rounded-md border p-1 shadow-lg">
        <button
          type="button"
          className="hover:bg-chip-gray text-tertiary flex w-full rounded px-1.5 py-1 text-left text-xs"
          onMouseDown={(e) => {
            e.preventDefault();
            onCommit(null);
          }}
        >
          Vaciar
        </button>
        {opts.length === 0 && <p className="text-tertiary px-1.5 py-1 text-xs">Sin resultados</p>}
        {opts.map((o) => (
          <button
            key={o.id}
            type="button"
            className="hover:bg-chip-gray flex w-full rounded px-1.5 py-1 text-left text-sm"
            onMouseDown={(e) => {
              e.preventDefault();
              onCommit(o.id);
            }}
          >
            {o.label}
          </button>
        ))}
      </div>
    </div>
  );
}

export const relationTypes = {
  RELATION: { Display: RelationDisplay, Edit: RelationEdit },
};
