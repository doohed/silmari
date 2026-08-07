'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { X, Plus, Link2 } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/Button';
import { Chip } from '@/components/fields/Chip';
import {
  updateRecordAction,
  createRecordAction,
  searchRecordsAction,
} from '@/app/(workspace)/objects/actions';

/**
 * Secciones de relaciones inversas: vincular/desvincular/crear registros que
 * apuntan a este.
 * @param {{ sections: object[], currentRecordId: string, onChange: ()=>void }} props
 */
export function RelationSection({ sections, currentRecordId, onChange }) {
  if (!sections?.length) {
    return (
      <p className="text-tertiary p-6 text-center text-sm">
        Este objeto no tiene relaciones entrantes
      </p>
    );
  }
  return (
    <div className="space-y-6 p-6">
      {sections.map((s) => (
        <Section
          key={s.fieldMetadataId}
          section={s}
          currentRecordId={currentRecordId}
          onChange={onChange}
        />
      ))}
    </div>
  );
}

function Section({ section, currentRecordId, onChange }) {
  const { sourceObject, fieldName } = section;
  const [picking, setPicking] = useState(false);

  async function link(sourceId) {
    const r = await updateRecordAction({
      objectSlug: sourceObject.slug,
      recordId: sourceId,
      data: { [fieldName]: currentRecordId },
    });
    if (r.ok) {
      setPicking(false);
      onChange();
    } else toast.error(r.message);
  }

  async function unlink(sourceId) {
    const r = await updateRecordAction({
      objectSlug: sourceObject.slug,
      recordId: sourceId,
      data: { [fieldName]: null },
    });
    if (r.ok) onChange();
    else toast.error(r.message);
  }

  async function create() {
    const data = { [fieldName]: currentRecordId };
    if (sourceObject.identifierName && sourceObject.identifierType === 'TEXT') {
      data[sourceObject.identifierName] = 'Sin título';
    }
    const r = await createRecordAction({ objectSlug: sourceObject.slug, data });
    if (r.ok) onChange();
    else toast.error(r.message);
  }

  return (
    <section>
      <div className="mb-2 flex items-center justify-between">
        <h3 className="text-primary text-sm font-medium">{sourceObject.labelPlural}</h3>
        <div className="flex gap-1">
          <Button size="sm" variant="ghost" onClick={() => setPicking((p) => !p)}>
            <Link2 size={13} /> Vincular
          </Button>
          <Button size="sm" variant="ghost" onClick={create}>
            <Plus size={13} /> Crear
          </Button>
        </div>
      </div>

      {picking && (
        <LinkPicker
          objectSlug={sourceObject.slug}
          onPick={link}
          onClose={() => setPicking(false)}
        />
      )}

      <ul className="space-y-1">
        {section.records.length === 0 && (
          <li className="text-tertiary text-xs">Sin {sourceObject.labelPlural.toLowerCase()}</li>
        )}
        {section.records.map((r) => (
          <li
            key={r.id}
            className="border-border bg-surface flex items-center gap-2 rounded-md border px-2 py-1.5"
          >
            <Link
              href={`/objects/${sourceObject.slug}/${r.id}`}
              className="min-w-0 flex-1 truncate"
            >
              <Chip label={r.label} color="blue" />
            </Link>
            <button
              type="button"
              onClick={() => unlink(r.id)}
              className="text-tertiary hover:text-danger shrink-0"
              aria-label="Desvincular"
            >
              <X size={14} />
            </button>
          </li>
        ))}
      </ul>
    </section>
  );
}

function LinkPicker({ objectSlug, onPick }) {
  const [q, setQ] = useState('');
  const [opts, setOpts] = useState([]);

  useEffect(() => {
    let active = true;
    searchRecordsAction({ objectSlug, q }).then((r) => {
      if (active && r?.ok) setOpts(r.data);
    });
    return () => {
      active = false;
    };
  }, [q, objectSlug]);

  return (
    <div className="border-border bg-elevated mb-2 rounded-md border p-2">
      <input
        autoFocus
        value={q}
        onChange={(e) => setQ(e.target.value)}
        placeholder="Buscar para vincular…"
        className="border-border bg-surface mb-1 h-8 w-full rounded-md border px-2 text-sm outline-none"
      />
      <ul className="max-h-48 overflow-auto">
        {opts.length === 0 && <li className="text-tertiary px-2 py-1 text-xs">Sin resultados</li>}
        {opts.map((o) => (
          <li key={o.id}>
            <button
              type="button"
              onClick={() => onPick(o.id)}
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

export default RelationSection;
