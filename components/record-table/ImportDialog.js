'use client';

import { useState } from 'react';
import * as Dialog from '@radix-ui/react-dialog';
import Papa from 'papaparse';
import { toast } from 'sonner';
import { Button } from '@/components/ui/Button';
import { isWritableField } from '@/lib/field-types';
import { importRecordsAction } from '@/app/(workspace)/objects/actions';

const IGNORE = '__ignore__';

/**
 * Importa un CSV: mapeo de columnas → campos, previsualización e importación con
 * informe de errores por fila.
 */
export function ImportDialog({ open, onOpenChange, objectSlug, fields, onImported }) {
  // Los campos de sistema los escribe el servidor: no se pueden importar.
  const targets = fields.filter(isWritableField);
  const [headers, setHeaders] = useState([]);
  const [rows, setRows] = useState([]);
  const [mapping, setMapping] = useState({});
  const [result, setResult] = useState(null);
  const [importing, setImporting] = useState(false);

  function reset() {
    setHeaders([]);
    setRows([]);
    setMapping({});
    setResult(null);
  }

  function onFile(e) {
    const file = e.target.files?.[0];
    if (!file) return;
    Papa.parse(file, {
      header: true,
      skipEmptyLines: true,
      complete: (res) => {
        const hs = res.meta.fields ?? [];
        setHeaders(hs);
        setRows(res.data);
        // Auto-mapeo por nombre o etiqueta.
        const auto = {};
        for (const h of hs) {
          const f = targets.find(
            (x) =>
              x.name.toLowerCase() === h.toLowerCase() || x.label.toLowerCase() === h.toLowerCase(),
          );
          auto[h] = f ? f.name : IGNORE;
        }
        setMapping(auto);
        setResult(null);
      },
    });
  }

  async function doImport() {
    const mapped = rows.map((row) => {
      const out = {};
      for (const h of headers) {
        if (mapping[h] && mapping[h] !== IGNORE) out[mapping[h]] = row[h];
      }
      return out;
    });
    setImporting(true);
    const r = await importRecordsAction({ objectSlug, rows: mapped });
    setImporting(false);
    if (!r.ok) return toast.error(r.message);
    setResult(r.data);
    if (r.data.created > 0) onImported?.();
  }

  return (
    <Dialog.Root
      open={open}
      onOpenChange={(o) => {
        if (!o) reset();
        onOpenChange(o);
      }}
    >
      <Dialog.Portal>
        <Dialog.Overlay className="anim-overlay fixed inset-0 z-50 bg-black/40" />
        <Dialog.Content className="anim-dialog mac-menu fixed top-1/2 left-1/2 z-50 max-h-[85vh] w-[92%] max-w-2xl -translate-x-1/2 -translate-y-1/2 overflow-auto rounded-lg border p-5 shadow-xl">
          <Dialog.Title className="text-primary mb-3 text-sm font-semibold">
            Importar CSV
          </Dialog.Title>
          <Dialog.Description className="sr-only">
            Importar registros desde un CSV
          </Dialog.Description>

          {headers.length === 0 ? (
            <input type="file" accept=".csv,text/csv" onChange={onFile} className="text-sm" />
          ) : (
            <div className="space-y-4">
              <div>
                <p className="text-secondary mb-2 text-xs">Asigna cada columna a un campo:</p>
                <div className="space-y-1.5">
                  {headers.map((h) => (
                    <div key={h} className="grid grid-cols-2 items-center gap-2">
                      <span className="text-primary truncate font-mono text-xs">{h}</span>
                      <select
                        value={mapping[h] ?? IGNORE}
                        onChange={(e) => setMapping({ ...mapping, [h]: e.target.value })}
                        className="border-border bg-surface h-8 rounded-md border px-2 text-xs"
                      >
                        <option value={IGNORE}>Ignorar</option>
                        {targets.map((f) => (
                          <option key={f.id} value={f.name}>
                            {f.label}
                          </option>
                        ))}
                      </select>
                    </div>
                  ))}
                </div>
              </div>

              <p className="text-tertiary text-xs">{rows.length} filas en el archivo</p>

              {result && (
                <div className="border-border bg-bg rounded-md border p-3 text-sm">
                  <p className="text-success">{result.created} importadas</p>
                  {result.failed > 0 && (
                    <>
                      <p className="text-danger">{result.failed} con errores:</p>
                      <ul className="text-tertiary mt-1 max-h-32 overflow-auto text-xs">
                        {result.errors.map((e) => (
                          <li key={e.row}>
                            Fila {e.row}: {e.message}
                          </li>
                        ))}
                      </ul>
                    </>
                  )}
                </div>
              )}

              <div className="flex gap-2">
                <Button size="sm" onClick={doImport} disabled={importing}>
                  {importing ? 'Importando…' : 'Importar'}
                </Button>
                <Button size="sm" variant="ghost" onClick={reset}>
                  Otro archivo
                </Button>
              </div>
            </div>
          )}
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}

export default ImportDialog;
