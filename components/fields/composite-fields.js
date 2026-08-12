'use client';

import { useState } from 'react';
import { Chip } from './Chip';
import { cellKeyDown, cellInputClass } from './cell-keys';
import { quoteTotals } from '@/lib/quotes/calc';
import { formatCurrency } from '@/lib/utils/format';
import { useWorkspaceSettings } from '@/components/providers/WorkspaceProvider';

const empty = <span className="text-tertiary">—</span>;

function ChipList({ items }) {
  if (!items?.length) return empty;
  return (
    <div className="flex flex-wrap gap-1">
      {items.map((t, i) => (
        <Chip key={`${t}-${i}`} label={t} />
      ))}
    </div>
  );
}

/** Editor de lista separada por comas. */
function makeListEdit(toText, fromText) {
  return function ListEdit({ value, onCommit, onCancel }) {
    const [v, setV] = useState(toText(value));
    const finish = (commit) => (commit ? onCommit(fromText(v)) : onCancel());
    return (
      <input
        autoFocus
        className={cellInputClass}
        value={v}
        placeholder="separa con comas"
        onChange={(e) => setV(e.target.value)}
        onKeyDown={cellKeyDown(finish)}
        onBlur={() => finish(true)}
      />
    );
  };
}

const strListText = (v) => (Array.isArray(v) ? v.join(', ') : '');
const strListFrom = (t) =>
  t
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean);

function FullNameDisplay({ value }) {
  const full = value ? `${value.firstName ?? ''} ${value.lastName ?? ''}`.trim() : '';
  return full ? <span className="truncate">{full}</span> : empty;
}

function FullNameEdit({ value, onCommit, onCancel }) {
  const [first, setFirst] = useState(value?.firstName ?? '');
  const [last, setLast] = useState(value?.lastName ?? '');
  const finish = (commit) => (commit ? onCommit({ firstName: first, lastName: last }) : onCancel());
  return (
    <div className="bg-elevated ring-accent flex h-full w-full gap-1 px-1 ring-2">
      <input
        autoFocus
        className="min-w-0 flex-1 bg-transparent text-sm outline-none"
        placeholder="Nombre"
        value={first}
        onChange={(e) => setFirst(e.target.value)}
        onKeyDown={cellKeyDown(finish)}
      />
      <input
        className="min-w-0 flex-1 bg-transparent text-sm outline-none"
        placeholder="Apellidos"
        value={last}
        onChange={(e) => setLast(e.target.value)}
        onKeyDown={cellKeyDown(finish)}
        onBlur={() => finish(true)}
      />
    </div>
  );
}

function AddressDisplay({ value }) {
  if (!value) return empty;
  const summary = [value.city, value.country].filter(Boolean).join(', ');
  return summary ? <span className="truncate">{summary}</span> : empty;
}

function LinksDisplay({ value }) {
  if (!Array.isArray(value) || value.length === 0) return empty;
  return <ChipList items={value.map((l) => l.label || l.url)} />;
}

/** Resumen compacto de líneas (la edición completa vive en la ficha). */
function LineItemsDisplay({ value }) {
  const { currency } = useWorkspaceSettings();
  if (!Array.isArray(value) || value.length === 0) return empty;
  const { count, total } = quoteTotals(value);
  return (
    <span className="tabular-nums">
      {count} {count === 1 ? 'línea' : 'líneas'} · {formatCurrency(total, currency)}
    </span>
  );
}

export const compositeTypes = {
  EMAILS: {
    Display: ({ value }) => <ChipList items={Array.isArray(value) ? value : []} />,
    Edit: makeListEdit(strListText, strListFrom),
  },
  PHONES: {
    Display: ({ value }) => <ChipList items={Array.isArray(value) ? value : []} />,
    Edit: makeListEdit(strListText, strListFrom),
  },
  LINKS: {
    Display: LinksDisplay,
    Edit: makeListEdit(
      (v) => (Array.isArray(v) ? v.map((l) => l.url).join(', ') : ''),
      (t) => strListFrom(t).map((url) => ({ url, label: '' })),
    ),
  },
  FULL_NAME: { Display: FullNameDisplay, Edit: FullNameEdit },
  ADDRESS: { Display: AddressDisplay },
  // Sin Edit inline: se edita a ancho completo en la ficha (LineItemsEditor).
  LINE_ITEMS: { Display: LineItemsDisplay },
};
