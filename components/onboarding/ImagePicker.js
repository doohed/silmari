'use client';

import { useRef, useState } from 'react';
import { Upload, Trash2 } from 'lucide-react';
import { toast } from 'sonner';
import { Avatar } from '@/components/ui/Avatar';
import { fileToSquareDataUrl } from '@/lib/utils/image';

/**
 * Selector de imagen (logo o foto): previsualiza, reescala en cliente y devuelve
 * un data URL vía onChange. Sin infra de almacenamiento.
 * @param {{ value: string|null, onChange: (v: string|null)=>void, name?: string, shape?: 'full'|'xl', label?: string }} props
 */
export function ImagePicker({ value, onChange, name = '', shape = 'full', label = 'Subir imagen' }) {
  const inputRef = useRef(null);
  const [busy, setBusy] = useState(false);

  async function onFile(e) {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    setBusy(true);
    try {
      const dataUrl = await fileToSquareDataUrl(file, { size: shape === 'xl' ? 128 : 256 });
      if (dataUrl.length > 400_000) {
        toast.error('La imagen es demasiado grande tras comprimir. Prueba con otra.');
        return;
      }
      onChange(dataUrl);
    } catch (err) {
      toast.error(err.message || 'No se pudo procesar la imagen');
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="flex items-center gap-3">
      <Avatar name={name} src={value} size={48} rounded={shape} />
      <button
        type="button"
        onClick={() => inputRef.current?.click()}
        disabled={busy}
        className="press border-border bg-surface text-primary hover:border-border-strong hover:shadow-xs flex h-9 items-center gap-2 rounded-lg border px-3 text-xs font-medium disabled:opacity-50"
      >
        <Upload size={14} /> {busy ? 'Procesando…' : label}
      </button>
      {value && (
        <button
          type="button"
          onClick={() => onChange(null)}
          className="press text-tertiary hover:text-danger"
          aria-label="Quitar imagen"
        >
          <Trash2 size={16} />
        </button>
      )}
      <input
        ref={inputRef}
        type="file"
        accept="image/png,image/jpeg,image/webp,image/gif"
        onChange={onFile}
        className="hidden"
      />
    </div>
  );
}

export default ImagePicker;
