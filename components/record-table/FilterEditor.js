'use client';

import { useState } from 'react';
import { X } from 'lucide-react';
import { getFieldType } from '@/lib/field-types';
import { Button } from '@/components/ui/Button';

const OP_LABEL = {
  eq: 'es',
  neq: 'no es',
  contains: 'contiene',
  notContains: 'no contiene',
  startsWith: 'empieza por',
  endsWith: 'termina en',
  gt: '>',
  gte: '≥',
  lt: '<',
  lte: '≤',
  before: 'antes de',
  after: 'después de',
  is: 'es',
  isNot: 'no es',
  isEmpty: 'vacío',
  isNotEmpty: 'no vacío',
  containsAny: 'contiene',
  containsAll: 'contiene todo',
};

const NO_VALUE = new Set(['isEmpty', 'isNotEmpty']);

/**
 * Editor de filtros de la vista.
 * @param {{ fields: object[], filters: object[], onChange: (f:object[])=>void }} props
 */
export function FilterEditor({ fields, filters, onChange }) {
  const [fieldName, setFieldName] = useState('');
  const [operator, setOperator] = useState('');
  const [value, setValue] = useState('');

  const field = fields.find((f) => f.name === fieldName);
  const operators = field ? getFieldType(field.type).filterOperators : [];

  function add() {
    if (!fieldName || !operator) return;
    const next = [
      ...filters,
      { fieldName, operator, value: NO_VALUE.has(operator) ? null : value },
    ];
    onChange(next);
    setFieldName('');
    setOperator('');
    setValue('');
  }

  return (
    <div className="border-border bg-elevated absolute top-full left-0 z-30 mt-1 w-80 rounded-md border p-3 shadow-lg">
      {filters.length > 0 && (
        <ul className="mb-2 space-y-1">
          {filters.map((f, i) => {
            const fl = fields.find((x) => x.name === f.fieldName);
            return (
              <li key={i} className="bg-bg flex items-center gap-1 rounded px-2 py-1 text-xs">
                <span className="text-primary font-medium">{fl?.label ?? f.fieldName}</span>
                <span className="text-secondary">{OP_LABEL[f.operator] ?? f.operator}</span>
                {!NO_VALUE.has(f.operator) && (
                  <span className="text-primary">{String(f.value)}</span>
                )}
                <button
                  type="button"
                  className="text-tertiary hover:text-danger ml-auto"
                  onClick={() => onChange(filters.filter((_, j) => j !== i))}
                >
                  <X size={13} />
                </button>
              </li>
            );
          })}
        </ul>
      )}

      <div className="flex flex-col gap-2">
        <select
          value={fieldName}
          onChange={(e) => {
            setFieldName(e.target.value);
            setOperator('');
          }}
          className="border-border bg-surface h-8 rounded-md border px-2 text-xs"
        >
          <option value="">Campo…</option>
          {fields.map((f) => (
            <option key={f.id} value={f.name}>
              {f.label}
            </option>
          ))}
        </select>

        {field && (
          <select
            value={operator}
            onChange={(e) => setOperator(e.target.value)}
            className="border-border bg-surface h-8 rounded-md border px-2 text-xs"
          >
            <option value="">Operador…</option>
            {operators.map((op) => (
              <option key={op} value={op}>
                {OP_LABEL[op] ?? op}
              </option>
            ))}
          </select>
        )}

        {operator && !NO_VALUE.has(operator) && (
          <input
            value={value}
            onChange={(e) => setValue(e.target.value)}
            placeholder="Valor"
            className="border-border bg-surface h-8 rounded-md border px-2 text-xs"
          />
        )}

        <Button size="sm" onClick={add} disabled={!fieldName || !operator}>
          Añadir filtro
        </Button>
      </div>
    </div>
  );
}

export default FilterEditor;
