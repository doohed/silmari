'use client';

import { useState } from 'react';
import { Chip } from './Chip';

const empty = <span className="text-tertiary">—</span>;

function optionsOf(field) {
  return field?.options ?? [];
}
function optionByValue(field, value) {
  return optionsOf(field).find((o) => o.value === value);
}

function SelectDisplay({ value, field }) {
  const opt = optionByValue(field, value);
  return opt ? <Chip label={opt.label} color={opt.color} /> : empty;
}

function Dropdown({ children, onCancel }) {
  return (
    <div
      className="border-border bg-elevated absolute top-full left-0 z-20 mt-1 max-h-60 w-56 overflow-auto rounded-md border p-1 shadow-lg"
      tabIndex={-1}
      onKeyDown={(e) => {
        if (e.key === 'Escape') {
          e.preventDefault();
          onCancel();
        }
      }}
    >
      {children}
    </div>
  );
}

function SelectEdit({ value, field, onCommit, onCancel }) {
  return (
    <Dropdown onCancel={onCancel}>
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
      {optionsOf(field).map((o) => (
        <button
          key={o.id ?? o.value}
          type="button"
          className={`hover:bg-chip-gray flex w-full rounded px-1.5 py-1 text-left ${o.value === value ? 'bg-chip-gray' : ''}`}
          onMouseDown={(e) => {
            e.preventDefault();
            onCommit(o.value);
          }}
        >
          <Chip label={o.label} color={o.color} />
        </button>
      ))}
    </Dropdown>
  );
}

function MultiSelectDisplay({ value, field }) {
  const values = Array.isArray(value) ? value : [];
  if (values.length === 0) return empty;
  return (
    <div className="flex flex-wrap gap-1">
      {values.map((v) => {
        const o = optionByValue(field, v);
        return <Chip key={v} label={o?.label ?? v} color={o?.color} />;
      })}
    </div>
  );
}

function MultiSelectEdit({ value, field, onCommit, onCancel }) {
  const [sel, setSel] = useState(new Set(Array.isArray(value) ? value : []));
  const toggle = (v) => {
    const next = new Set(sel);
    if (next.has(v)) next.delete(v);
    else next.add(v);
    setSel(next);
  };
  return (
    <Dropdown onCancel={onCancel}>
      <div
        onKeyDown={(e) => {
          if (e.key === 'Enter') {
            e.preventDefault();
            onCommit([...sel]);
          }
        }}
      >
        {optionsOf(field).map((o) => (
          <button
            key={o.id ?? o.value}
            type="button"
            className="hover:bg-chip-gray flex w-full items-center gap-2 rounded px-1.5 py-1 text-left"
            onMouseDown={(e) => {
              e.preventDefault();
              toggle(o.value);
            }}
          >
            <input
              type="checkbox"
              readOnly
              checked={sel.has(o.value)}
              className="accent-accent size-3.5"
            />
            <Chip label={o.label} color={o.color} />
          </button>
        ))}
        <button
          type="button"
          className="text-accent w-full px-1.5 py-1 text-left text-xs font-medium"
          onMouseDown={(e) => {
            e.preventDefault();
            onCommit([...sel]);
          }}
        >
          Aplicar
        </button>
      </div>
    </Dropdown>
  );
}

export const choiceTypes = {
  SELECT: { Display: SelectDisplay, Edit: SelectEdit },
  MULTI_SELECT: { Display: MultiSelectDisplay, Edit: MultiSelectEdit },
};
