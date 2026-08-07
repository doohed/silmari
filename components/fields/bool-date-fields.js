'use client';

import { useState } from 'react';
import { format, isValid } from 'date-fns';
import { Check } from 'lucide-react';
import { cellInputClass } from './cell-keys';

const empty = <span className="text-tertiary">—</span>;

function fmt(value, pattern) {
  if (!value) return null;
  const d = new Date(value);
  return isValid(d) ? format(d, pattern) : null;
}

function BooleanDisplay({ value }) {
  return value ? (
    <Check size={15} className="text-success" />
  ) : (
    <span className="text-tertiary">—</span>
  );
}

function BooleanEdit({ value, onCommit }) {
  // Toggle inmediato: confirma al cambiar.
  return (
    <input
      autoFocus
      type="checkbox"
      className="accent-accent ml-2 size-4"
      defaultChecked={Boolean(value)}
      onChange={(e) => onCommit(e.target.checked)}
    />
  );
}

function DateDisplay({ value }) {
  const t = fmt(value, 'dd/MM/yyyy');
  return t ? <span>{t}</span> : empty;
}

function DateTimeDisplay({ value }) {
  const t = fmt(value, 'dd/MM/yyyy HH:mm');
  return t ? <span>{t}</span> : empty;
}

function makeDateEdit(inputType, toValue) {
  return function DateEdit({ value, onCommit, onCancel }) {
    const [v, setV] = useState(toValue(value));
    return (
      <input
        autoFocus
        type={inputType}
        className={cellInputClass}
        value={v}
        onChange={(e) => setV(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === 'Enter') {
            e.preventDefault();
            onCommit(v ? new Date(v).toISOString() : null);
          } else if (e.key === 'Escape') {
            e.preventDefault();
            onCancel();
          }
        }}
        onBlur={() => onCommit(v ? new Date(v).toISOString() : null)}
      />
    );
  };
}

const toDateInput = (value) => (value ? format(new Date(value), 'yyyy-MM-dd') : '');
const toDateTimeInput = (value) => (value ? format(new Date(value), "yyyy-MM-dd'T'HH:mm") : '');

export const boolDateTypes = {
  BOOLEAN: { Display: BooleanDisplay, Edit: BooleanEdit },
  DATE: { Display: DateDisplay, Edit: makeDateEdit('date', toDateInput) },
  DATE_TIME: { Display: DateTimeDisplay, Edit: makeDateEdit('datetime-local', toDateTimeInput) },
};
