'use client';

import { useEffect, useRef, useState } from 'react';
import { Plus, Trash2 } from 'lucide-react';
import { lineTotal, quoteTotals } from '@/lib/quotes/calc';
import { formatCurrency } from '@/lib/utils/format';
import { useWorkspaceSettings } from '@/components/providers/WorkspaceProvider';
import { useClickOutside } from '@/hooks/useClickOutside';
import { searchProductsAction } from '@/app/(workspace)/objects/actions';

const NEW_LINE = { description: '', quantity: 1, unitPrice: 0, discount: 0 };
const CELL = 'border-border bg-surface text-primary h-8 rounded-md border px-2 text-sm';

/** ¿Cambiaron las líneas respecto al valor guardado? */
function isDirty(a, b) {
  return JSON.stringify(a) !== JSON.stringify(b);
}

/**
 * Combobox de producto: escribe para buscar en el catálogo; al elegir uno,
 * autorellena descripción y precio. También admite texto libre (sin producto).
 */
function ProductCell({ description, objectSlug, priceFieldName, money, onText, onPick }) {
  const [open, setOpen] = useState(false);
  const [opts, setOpts] = useState([]);
  const ref = useRef(null);
  useClickOutside(ref, () => setOpen(false));

  useEffect(() => {
    if (!open) return undefined;
    let active = true;
    searchProductsAction({ objectSlug, priceFieldName, q: description }).then((r) => {
      if (active && r?.ok) setOpts(r.data);
    });
    return () => {
      active = false;
    };
  }, [description, open, objectSlug, priceFieldName]);

  return (
    <div ref={ref} className="relative">
      <input
        className={`${CELL} w-full`}
        value={description}
        placeholder="Buscar producto o escribir"
        onFocus={() => setOpen(true)}
        onChange={(e) => {
          onText(e.target.value);
          setOpen(true);
        }}
      />
      {open && opts.length > 0 && (
        <div className="mac-menu absolute top-full left-0 z-20 mt-1 max-h-56 w-72 overflow-auto rounded-md border p-1 shadow-lg">
          {opts.map((o) => (
            <button
              key={o.id}
              type="button"
              className="hover:bg-chip-gray flex w-full items-center justify-between gap-2 rounded px-1.5 py-1 text-left text-sm"
              onMouseDown={(e) => {
                e.preventDefault();
                onPick(o);
                setOpen(false);
              }}
            >
              <span className="truncate">{o.label}</span>
              <span className="text-tertiary shrink-0 tabular-nums">{money(o.price)}</span>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

/**
 * Editor de líneas (LINE_ITEMS) a ancho completo para la ficha: añadir/quitar
 * filas, cantidad/precio/descuento y totales en vivo. Persiste con
 * `onCommit(lines)` al pulsar "Guardar líneas". Si el campo tiene catálogo
 * (`settings.lineItems.productObjectSlug`), la descripción es un selector de
 * producto que autorellena descripción y precio.
 * @param {{ field?: object, value: Array<object>, onCommit: (lines:Array<object>)=>void }} props
 */
export function LineItemsEditor({ field, value, onCommit }) {
  const { currency } = useWorkspaceSettings();
  const saved = Array.isArray(value) ? value : [];
  const [rows, setRows] = useState(saved);

  const catalog = field?.settings?.lineItems;
  const dirty = isDirty(rows, saved);
  const totals = quoteTotals(rows);

  const setRow = (i, patch) => setRows(rows.map((r, j) => (j === i ? { ...r, ...patch } : r)));
  const addRow = () => setRows([...rows, { ...NEW_LINE }]);
  const removeRow = (i) => setRows(rows.filter((_, j) => j !== i));
  const numInput = (i, key) => (e) =>
    setRow(i, { [key]: e.target.value === '' ? 0 : Number(e.target.value) });

  const money = (n) => formatCurrency(n, currency);

  return (
    <div className="border-border bg-bg space-y-2 rounded-lg border p-3">
      {rows.length === 0 ? (
        <p className="text-tertiary text-sm">Sin líneas</p>
      ) : (
        <div className="space-y-1.5">
          <div className="text-tertiary grid grid-cols-[1fr_64px_88px_56px_88px_28px] gap-2 px-1 text-[11px] font-medium tracking-wide uppercase">
            <span>Descripción</span>
            <span className="text-right">Cant.</span>
            <span className="text-right">Precio</span>
            <span className="text-right">Dto %</span>
            <span className="text-right">Total</span>
            <span />
          </div>
          {rows.map((row, i) => (
            <div
              key={i}
              className="grid grid-cols-[1fr_64px_88px_56px_88px_28px] items-center gap-2"
            >
              {catalog?.productObjectSlug ? (
                <ProductCell
                  description={row.description}
                  objectSlug={catalog.productObjectSlug}
                  priceFieldName={catalog.priceFieldName}
                  money={money}
                  onText={(text) => setRow(i, { description: text, productId: undefined })}
                  onPick={(p) =>
                    setRow(i, { description: p.label, unitPrice: p.price, productId: p.id })
                  }
                />
              ) : (
                <input
                  className={CELL}
                  value={row.description}
                  placeholder="Concepto"
                  onChange={(e) => setRow(i, { description: e.target.value })}
                />
              )}
              <input
                type="number"
                className={`${CELL} text-right`}
                value={row.quantity}
                onChange={numInput(i, 'quantity')}
              />
              <input
                type="number"
                className={`${CELL} text-right`}
                value={row.unitPrice}
                onChange={numInput(i, 'unitPrice')}
              />
              <input
                type="number"
                className={`${CELL} text-right`}
                value={row.discount}
                onChange={numInput(i, 'discount')}
              />
              <span className="text-secondary text-right text-sm tabular-nums">
                {money(lineTotal(row))}
              </span>
              <button
                type="button"
                onClick={() => removeRow(i)}
                className="text-tertiary hover:text-danger flex justify-center"
                aria-label="Quitar línea"
              >
                <Trash2 size={14} />
              </button>
            </div>
          ))}
        </div>
      )}

      <button
        type="button"
        onClick={addRow}
        className="text-accent flex items-center gap-1 text-xs font-medium"
      >
        <Plus size={13} /> Añadir línea
      </button>

      <div className="border-border flex items-end justify-between border-t pt-2">
        <div className="text-tertiary space-y-0.5 text-xs tabular-nums">
          <div>Subtotal: {money(totals.subtotal)}</div>
          {totals.discountTotal > 0 && <div>Descuento: −{money(totals.discountTotal)}</div>}
        </div>
        <div className="flex items-center gap-3">
          <span className="text-primary text-sm font-semibold tabular-nums">
            Total: {money(totals.total)}
          </span>
          <button
            type="button"
            disabled={!dirty}
            onClick={() => onCommit(rows)}
            className="bg-accent text-accent-fg mac-disabled rounded-md px-2.5 py-1 text-xs font-medium"
          >
            Guardar líneas
          </button>
        </div>
      </div>
    </div>
  );
}

export default LineItemsEditor;
