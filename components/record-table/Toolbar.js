'use client';

import { useState } from 'react';
import { Plus, Filter, Trash2, Download, Upload } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { FilterEditor } from './FilterEditor';

/**
 * Acciones de la tabla (se colocan a la derecha de `RecordViewBar`): filtrar,
 * importar, exportar y nuevo registro; en modo selección, exportar/eliminar.
 * Devuelve solo el grupo de botones — la barra la aporta `RecordViewBar`.
 */
export function Toolbar({
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
      <>
        <span className="text-secondary mr-1 text-xs font-medium">
          {selectedCount} seleccionados
        </span>
        <Button size="sm" variant="ghost" onClick={onExport}>
          <Download size={14} /> Exportar
        </Button>
        <Button size="sm" variant="danger" onClick={onDeleteSelected}>
          <Trash2 size={14} /> Eliminar
        </Button>
      </>
    );
  }

  return (
    <>
      <div className="relative">
        <Button size="sm" variant="ghost" onClick={() => setShowFilter((s) => !s)}>
          <Filter size={14} /> Filtrar
          {filters.length > 0 && (
            <span className="bg-accent text-accent-fg ml-1 rounded-full px-1.5 text-[10px]">
              {filters.length}
            </span>
          )}
        </Button>
        {showFilter && <FilterEditor fields={fields} filters={filters} onChange={onFiltersChange} />}
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
    </>
  );
}

export default Toolbar;
