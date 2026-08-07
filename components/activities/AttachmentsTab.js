'use client';

import { useEffect, useRef, useState } from 'react';
import { Upload, Trash2, FileText } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/Button';
import { listAttachmentsAction, deleteAttachmentAction } from '@/app/(workspace)/objects/actions';

function formatSize(bytes) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} KB`;
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
}

export function AttachmentsTab({ object, recordId }) {
  const [files, setFiles] = useState([]);
  const inputRef = useRef(null);

  async function refresh() {
    const r = await listAttachmentsAction({ recordId });
    if (r.ok) setFiles(r.data);
  }
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    refresh();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [recordId]);

  async function onFile(e) {
    const file = e.target.files?.[0];
    if (!file) return;
    const fd = new FormData();
    fd.append('file', file);
    fd.append('targets', JSON.stringify([{ objectMetadataId: object.id, recordId }]));
    const res = await fetch('/api/upload', { method: 'POST', body: fd });
    if (res.ok) {
      toast.success('Archivo subido');
      refresh();
    } else {
      toast.error('No se pudo subir el archivo');
    }
    e.target.value = '';
  }

  async function remove(id) {
    const r = await deleteAttachmentAction({ id });
    if (r.ok) refresh();
  }

  return (
    <div className="space-y-4 p-6">
      <input ref={inputRef} type="file" className="hidden" onChange={onFile} />
      <Button size="sm" onClick={() => inputRef.current?.click()}>
        <Upload size={14} /> Subir archivo
      </Button>

      <ul className="space-y-1">
        {files.length === 0 && <li className="text-tertiary text-sm">Sin archivos todavía</li>}
        {files.map((f) => (
          <li
            key={f.id}
            className="border-border bg-surface flex items-center gap-2 rounded-md border px-3 py-2"
          >
            <FileText size={15} className="text-tertiary shrink-0" />
            <a
              href={`/api/files/${f.id}`}
              target="_blank"
              rel="noreferrer"
              className="text-primary min-w-0 flex-1 truncate text-sm hover:underline"
            >
              {f.name}
            </a>
            <span className="text-tertiary shrink-0 text-xs">{formatSize(f.size)}</span>
            <button
              type="button"
              onClick={() => remove(f.id)}
              className="text-tertiary hover:text-danger shrink-0"
              aria-label="Eliminar archivo"
            >
              <Trash2 size={14} />
            </button>
          </li>
        ))}
      </ul>
    </div>
  );
}

export default AttachmentsTab;
