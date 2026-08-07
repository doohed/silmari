'use client';

import { useState } from 'react';
import { cellKeyDown, cellInputClass } from './cell-keys';

function TextDisplay({ value }) {
  if (value == null || value === '') return <span className="text-tertiary">—</span>;
  return <span className="truncate">{String(value)}</span>;
}

function TextEdit({ value, onCommit, onCancel }) {
  const [v, setV] = useState(value ?? '');
  const finish = (commit) => (commit ? onCommit(v === '' ? null : v) : onCancel());
  return (
    <input
      autoFocus
      className={cellInputClass}
      value={v}
      onChange={(e) => setV(e.target.value)}
      onKeyDown={cellKeyDown(finish)}
      onBlur={() => finish(true)}
    />
  );
}

function RichTextDisplay({ value }) {
  const text = typeof value === 'string' ? value.replace(/<[^>]*>/g, ' ') : '';
  if (!text.trim()) return <span className="text-tertiary">—</span>;
  return <span className="truncate">{text}</span>;
}

function RichTextEdit({ value, onCommit, onCancel }) {
  const [v, setV] = useState(typeof value === 'string' ? value : '');
  return (
    <textarea
      autoFocus
      className={`${cellInputClass} resize-none py-1`}
      rows={3}
      value={v}
      onChange={(e) => setV(e.target.value)}
      onKeyDown={(e) => {
        if (e.key === 'Escape') {
          e.preventDefault();
          onCancel();
        }
      }}
      onBlur={() => onCommit(v === '' ? null : v)}
    />
  );
}

function JsonDisplay({ value }) {
  if (value == null) return <span className="text-tertiary">—</span>;
  return <span className="text-tertiary truncate font-mono text-xs">{JSON.stringify(value)}</span>;
}

export const textTypes = {
  TEXT: { Display: TextDisplay, Edit: TextEdit },
  UUID: { Display: TextDisplay, Edit: TextEdit },
  POSITION: { Display: TextDisplay },
  RICH_TEXT: { Display: RichTextDisplay, Edit: RichTextEdit },
  RAW_JSON: { Display: JsonDisplay },
  ACTOR: {
    Display: ({ value }) =>
      value?.name ? (
        <span className="truncate">{value.name}</span>
      ) : (
        <span className="text-tertiary">—</span>
      ),
  },
  ARRAY: {
    Display: ({ value }) =>
      Array.isArray(value) && value.length ? (
        <span className="truncate">{value.join(', ')}</span>
      ) : (
        <span className="text-tertiary">—</span>
      ),
  },
};

export { TextDisplay, TextEdit };
