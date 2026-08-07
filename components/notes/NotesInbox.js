'use client';

import { useEffect, useState } from 'react';
import { Plus, Trash2, Pin, PinOff } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { NoteEditor } from '@/components/activities/NoteEditor';
import {
  listNotesAction,
  createNoteAction,
  updateNoteAction,
  deleteNoteAction,
} from '@/app/(workspace)/notes/actions';

/** Libreta de apuntes personales del usuario (separada de las notas de registros). */
export function NotesInbox() {
  const [notes, setNotes] = useState([]);
  const [loading, setLoading] = useState(true);
  const [composing, setComposing] = useState(false);
  const [title, setTitle] = useState('');
  const [body, setBody] = useState(null);
  const [editorKey, setEditorKey] = useState(0);

  async function refresh() {
    const r = await listNotesAction();
    if (r.ok) setNotes(r.data);
    setLoading(false);
  }
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    refresh();
  }, []);

  function resetComposer() {
    setTitle('');
    setBody(null);
    setComposing(false);
    setEditorKey((k) => k + 1);
  }

  async function create() {
    if (!title.trim() && !body) {
      toast.error('Escribe un título o algo de contenido');
      return;
    }
    const r = await createNoteAction({ title, body });
    if (!r.ok) return toast.error(r.message);
    resetComposer();
    setNotes((prev) => [r.data, ...prev]);
    toast.success('Apunte guardado');
  }

  async function remove(id) {
    setNotes((prev) => prev.filter((n) => n.id !== id));
    const r = await deleteNoteAction({ id });
    if (!r.ok) {
      toast.error(r.message);
      refresh();
    }
  }

  async function togglePin(note) {
    const r = await updateNoteAction({ id: note.id, patch: { pinned: !note.pinned } });
    if (!r.ok) return toast.error(r.message);
    refresh();
  }

  function onSaved(updated) {
    setNotes((prev) => prev.map((n) => (n.id === updated.id ? updated : n)));
  }

  return (
    <main className="mx-auto w-full max-w-5xl px-6 py-10">
      <div className="mb-6 flex items-center justify-between">
        <div>
          <h1 className="text-primary text-xl font-semibold tracking-tight">Apuntes</h1>
          <p className="text-secondary mt-1 text-sm">Tus notas personales, solo para ti</p>
        </div>
        {!composing && (
          <Button size="sm" onClick={() => setComposing(true)}>
            <Plus size={14} /> Nueva nota
          </Button>
        )}
      </div>

      {composing && (
        <div className="border-border bg-surface anim-fade-up mb-6 space-y-3 rounded-xl border p-4 shadow-sm">
          <Input placeholder="Título" autoFocus value={title} onChange={(e) => setTitle(e.target.value)} />
          <NoteEditor key={editorKey} onChange={setBody} />
          <div className="flex gap-2">
            <Button size="sm" onClick={create}>
              Guardar
            </Button>
            <Button size="sm" variant="ghost" onClick={resetComposer}>
              Cancelar
            </Button>
          </div>
        </div>
      )}

      {loading ? (
        <p className="text-tertiary text-sm">Cargando…</p>
      ) : notes.length === 0 && !composing ? (
        <div className="border-border anim-fade-up flex flex-col items-center rounded-xl border border-dashed py-16 text-center">
          <div className="bg-accent-subtle text-accent mb-3 flex size-12 items-center justify-center rounded-2xl">
            <Plus size={22} />
          </div>
          <p className="text-primary text-sm font-medium">Aún no tienes apuntes</p>
          <p className="text-secondary mt-1 text-xs">Crea tu primera nota para empezar</p>
        </div>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {notes.map((note) => (
            <NoteCard
              key={note.id}
              note={note}
              onSaved={onSaved}
              onDelete={() => remove(note.id)}
              onTogglePin={() => togglePin(note)}
            />
          ))}
        </div>
      )}
    </main>
  );
}

/** Tarjeta de un apunte: lectura, y edición en sitio (título + cuerpo). */
function NoteCard({ note, onSaved, onDelete, onTogglePin }) {
  const [editing, setEditing] = useState(false);
  const [title, setTitle] = useState(note.title);
  const [body, setBody] = useState(note.body);

  async function save() {
    const r = await updateNoteAction({ id: note.id, patch: { title, body } });
    if (!r.ok) return toast.error(r.message);
    onSaved(r.data);
    setEditing(false);
    toast.success('Apunte actualizado');
  }

  return (
    <div className="border-border bg-surface hover-lift flex flex-col rounded-xl border p-4 shadow-sm">
      <div className="mb-2 flex items-start justify-between gap-2">
        {editing ? (
          <Input
            placeholder="Título"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            className="h-8"
          />
        ) : (
          <button
            type="button"
            onClick={() => setEditing(true)}
            className="text-primary min-w-0 flex-1 truncate text-left text-sm font-semibold"
          >
            {note.title || 'Sin título'}
          </button>
        )}
        <div className="flex shrink-0 items-center gap-1">
          <button
            type="button"
            onClick={onTogglePin}
            className={`press ${note.pinned ? 'text-accent' : 'text-tertiary hover:text-secondary'}`}
            aria-label={note.pinned ? 'Quitar fijado' : 'Fijar'}
            title={note.pinned ? 'Quitar fijado' : 'Fijar'}
          >
            {note.pinned ? <Pin size={14} /> : <PinOff size={14} />}
          </button>
          <button
            type="button"
            onClick={onDelete}
            className="press text-tertiary hover:text-danger"
            aria-label="Eliminar apunte"
          >
            <Trash2 size={14} />
          </button>
        </div>
      </div>

      {editing ? (
        <>
          <NoteEditor content={note.body} onChange={setBody} />
          <div className="mt-3 flex gap-2">
            <Button size="sm" onClick={save}>
              Guardar
            </Button>
            <Button size="sm" variant="ghost" onClick={() => setEditing(false)}>
              Cancelar
            </Button>
          </div>
        </>
      ) : (
        <button type="button" onClick={() => setEditing(true)} className="min-w-0 text-left">
          <NoteEditor content={note.body} editable={false} />
        </button>
      )}
    </div>
  );
}

export default NotesInbox;
