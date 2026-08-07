'use client';

import { useState } from 'react';
import { Plus, Filter, Trash2, Download, Upload } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { FilterEditor } from './FilterEditor';

/**
 * Barra superior de la tabla: nombre de vista, filtros, nuevo registro y
 * acciones de selección.
 */
export function Toolbar({
  viewName,
  count,
  selectedCount,
  fields,
  filters,
  onFiltersChange,
  onNewRecord,
  onDeleteSelected,
  onExport,
  onImport,
}) {
  const [showFilter, setShowFilter] = useState(false);

  if (selectedCount > 0) {
    return (
      <div className="border-border bg-accent-subtle anim-fade-up flex h-12 shrink-0 items-center gap-3 border-b px-5">
        <span className="text-primary text-sm font-medium">{selectedCount} seleccionados</span>
        <Button size="sm" variant="ghost" onClick={onExport}>
          <Download size={14} /> Exportar
        </Button>
        <Button size="sm" variant="danger" onClick={onDeleteSelected}>
          <Trash2 size={14} /> Eliminar
        </Button>
      </div>
    );
  }

  return (
    <div className="border-border flex h-12 shrink-0 items-center justify-between border-b px-5">
      <div className="flex items-center gap-2">
        <span className="text-primary text-sm font-medium">{viewName}</span>
        <span className="text-tertiary text-xs">{count}</span>
      </div>

      <div className="flex items-center gap-2">
        <div className="relative">
          <Button size="sm" variant="ghost" onClick={() => setShowFilter((s) => !s)}>
            <Filter size={14} /> Filtrar
            {filters.length > 0 && (
              <span className="bg-accent text-accent-fg ml-1 rounded-full px-1.5 text-[10px]">
                {filters.length}
              </span>
            )}
          </Button>
          {showFilter && (
            <FilterEditor fields={fields} filters={filters} onChange={onFiltersChange} />
          )}
        </div>
        <Button size="sm" variant="ghost" onClick={onImport}>
          <Upload size={14} /> Importar
        </Button>
        <Button size="sm" variant="ghost" onClick={onExport}>
          <Download size={14} /> Exportar
        </Button>
        <Button size="sm" onClick={onNewRecord}>
          <Plus size={14} /> Nuevo
        </Button>
      </div>
    </div>
  );
}

export default Toolbar;
