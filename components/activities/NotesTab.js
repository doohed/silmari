'use client';

import { useEffect, useState } from 'react';
import { Plus, Trash2, Link2 } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Chip } from '@/components/fields/Chip';
import { NoteEditor } from './NoteEditor';
import { TargetPicker } from './TargetPicker';
import {
  listActivitiesAction,
  createActivityAction,
  deleteActivityAction,
} from '@/app/(workspace)/objects/actions';

export function NotesTab({ object, recordId }) {
  const [notes, setNotes] = useState([]);
  const [open, setOpen] = useState(false);
  const [title, setTitle] = useState('');
  const [body, setBody] = useState(null);
  const [extra, setExtra] = useState([]);
  const [picking, setPicking] = useState(false);
  const [editorKey, setEditorKey] = useState(0);

  async function refresh() {
    const r = await listActivitiesAction({ recordId, type: 'NOTE' });
    if (r.ok) setNotes(r.data);
  }
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    refresh();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [recordId]);

  async function save() {
    const targets = [
      { objectMetadataId: object.id, recordId },
      ...extra.map((e) => ({ objectMetadataId: e.objectMetadataId, recordId: e.recordId })),
    ];
    const r = await createActivityAction({ type: 'NOTE', title, body, targets });
    if (!r.ok) return toast.error(r.message);
    setTitle('');
    setBody(null);
    setExtra([]);
    setOpen(false);
    setEditorKey((k) => k + 1);
    refresh();
    toast.success('Nota creada');
  }

  async function remove(id) {
    const r = await deleteActivityAction({ id });
    if (r.ok) refresh();
  }

  return (
    <div className="space-y-4 p-6">
      {!open ? (
        <Button size="sm" onClick={() => setOpen(true)}>
          <Plus size={14} /> Nueva nota
        </Button>
      ) : (
        <div className="border-border bg-bg space-y-2 rounded-lg border p-3">
          <Input placeholder="Título" value={title} onChange={(e) => setTitle(e.target.value)} />
          <NoteEditor key={editorKey} onChange={setBody} />

          <div className="flex flex-wrap items-center gap-1">
            {extra.map((t) => (
              <Chip key={t.recordId} label={t.label} color="blue" />
            ))}
            <button
              type="button"
              onClick={() => setPicking((p) => !p)}
              className="text-accent flex items-center gap-1 text-xs font-medium"
            >
              <Link2 size={13} /> Vincular a otro registro
            </button>
          </div>
          {picking && (
            <TargetPicker
              onAdd={(t) => {
                setExtra((prev) =>
                  prev.some((e) => e.recordId === t.recordId) ? prev : [...prev, t],
                );
                setPicking(false);
              }}
            />
          )}

          <div className="flex gap-2">
            <Button size="sm" onClick={save}>
              Guardar nota
            </Button>
            <Button size="sm" variant="ghost" onClick={() => setOpen(false)}>
              Cancelar
            </Button>
          </div>
        </div>
      )}

      <ul className="space-y-3">
        {notes.length === 0 && <li className="text-tertiary text-sm">Sin notas todavía</li>}
        {notes.map((n) => (
          <li key={n.id} className="border-border bg-surface rounded-lg border p-3">
            <div className="mb-1 flex items-start justify-between">
              <p className="text-primary text-sm font-medium">{n.title || 'Nota'}</p>
              <button
                type="button"
                onClick={() => remove(n.id)}
                className="text-tertiary hover:text-danger"
                aria-label="Eliminar nota"
              >
                <Trash2 size={14} />
              </button>
            </div>
            <NoteEditor content={n.body} editable={false} />
          </li>
        ))}
      </ul>
    </div>
  );
}

export default NotesTab;
