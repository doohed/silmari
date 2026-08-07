'use client';

import { useState } from 'react';
import { cellKeyDown, cellInputClass } from './cell-keys';
import { formatNumber, formatCurrency } from '@/lib/utils/format';
import { useWorkspaceSettings } from '@/components/providers/WorkspaceProvider';

const empty = <span className="text-tertiary">—</span>;

function NumberDisplay({ value }) {
  return value == null ? empty : <span className="tabular-nums">{formatNumber(value)}</span>;
}

function NumberEdit({ value, onCommit, onCancel }) {
  const [v, setV] = useState(value ?? '');
  const finish = (commit) => (commit ? onCommit(v === '' ? null : Number(v)) : onCancel());
  return (
    <input
      autoFocus
      type="number"
      className={cellInputClass}
      value={v}
      onChange={(e) => setV(e.target.value)}
      onKeyDown={cellKeyDown(finish)}
      onBlur={() => finish(true)}
    />
  );
}

function PercentDisplay({ value }) {
  return value == null ? empty : <span className="tabular-nums">{formatNumber(value)}%</span>;
}

function RatingDisplay({ value }) {
  if (value == null) return empty;
  return (
    <span className="text-accent">
      {'★'.repeat(value)}
      {'☆'.repeat(Math.max(0, 5 - value))}
    </span>
  );
}

function CurrencyDisplay({ value }) {
  const { currency } = useWorkspaceSettings();
  if (value == null) return empty;
  // La moneda de visualización es la del workspace (el código por-valor nunca lo
  // elige el usuario), así cambiarla se refleja en toda la app.
  return <span className="tabular-nums">{formatCurrency(value.amount, currency)}</span>;
}

function CurrencyEdit({ value, onCommit, onCancel }) {
  const { currency } = useWorkspaceSettings();
  const [v, setV] = useState(value?.amount ?? '');
  const code = value?.currencyCode ?? currency;
  const finish = (commit) =>
    commit ? onCommit(v === '' ? null : { amount: Number(v), currencyCode: code }) : onCancel();
  return (
    <input
      autoFocus
      type="number"
      className={cellInputClass}
      value={v}
      onChange={(e) => setV(e.target.value)}
      onKeyDown={cellKeyDown(finish)}
      onBlur={() => finish(true)}
    />
  );
}

export const numberTypes = {
  NUMBER: { Display: NumberDisplay, Edit: NumberEdit },
  PERCENT: { Display: PercentDisplay, Edit: NumberEdit },
  RATING: { Display: RatingDisplay, Edit: NumberEdit },
  CURRENCY: { Display: CurrencyDisplay, Edit: CurrencyEdit },
};
