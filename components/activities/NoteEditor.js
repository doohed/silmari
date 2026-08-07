'use client';

import { useEditor, EditorContent } from '@tiptap/react';
import StarterKit from '@tiptap/starter-kit';
import TaskList from '@tiptap/extension-task-list';
import TaskItem from '@tiptap/extension-task-item';
import { Bold, List, ListOrdered, ListChecks, Code, Link as LinkIcon } from 'lucide-react';

const extensions = [
  StarterKit.configure({ link: { openOnClick: false, autolink: true } }),
  TaskList,
  TaskItem.configure({ nested: true }),
];

function ToolbarButton({ active, onClick, title, children }) {
  return (
    <button
      type="button"
      title={title}
      onMouseDown={(e) => e.preventDefault()}
      onClick={onClick}
      className={`rounded p-1 transition-colors ${active ? 'bg-accent-subtle text-primary' : 'text-secondary hover:bg-chip-gray'}`}
    >
      {children}
    </button>
  );
}

/**
 * Editor de texto enriquecido (Tiptap). Editable para componer, o de solo
 * lectura para mostrar una nota guardada.
 * @param {{ content?: any, editable?: boolean, onChange?: (json:any)=>void }} props
 */
export function NoteEditor({ content, editable = true, onChange }) {
  const editor = useEditor({
    extensions,
    content: content ?? '',
    editable,
    immediatelyRender: false,
    editorProps: {
      attributes: { class: 'tiptap min-h-[60px] px-2 py-1.5 text-sm outline-none' },
    },
    onUpdate: ({ editor: e }) => onChange?.(e.getJSON()),
  });

  if (!editor) return null;

  return (
    <div className={editable ? 'border-border bg-surface rounded-md border' : ''}>
      {editable && (
        <div className="border-border flex gap-0.5 border-b p-1">
          <ToolbarButton
            title="Negrita"
            active={editor.isActive('bold')}
            onClick={() => editor.chain().focus().toggleBold().run()}
          >
            <Bold size={15} />
          </ToolbarButton>
          <ToolbarButton
            title="Lista"
            active={editor.isActive('bulletList')}
            onClick={() => editor.chain().focus().toggleBulletList().run()}
          >
            <List size={15} />
          </ToolbarButton>
          <ToolbarButton
            title="Lista numerada"
            active={editor.isActive('orderedList')}
            onClick={() => editor.chain().focus().toggleOrderedList().run()}
          >
            <ListOrdered size={15} />
          </ToolbarButton>
          <ToolbarButton
            title="Checklist"
            active={editor.isActive('taskList')}
            onClick={() => editor.chain().focus().toggleTaskList().run()}
          >
            <ListChecks size={15} />
          </ToolbarButton>
          <ToolbarButton
            title="Código"
            active={editor.isActive('code')}
            onClick={() => editor.chain().focus().toggleCode().run()}
          >
            <Code size={15} />
          </ToolbarButton>
          <ToolbarButton
            title="Enlace"
            active={editor.isActive('link')}
            onClick={() => {
              const url = window.prompt('URL del enlace');
              if (url) editor.chain().focus().toggleLink({ href: url }).run();
              else editor.chain().focus().unsetLink().run();
            }}
          >
            <LinkIcon size={15} />
          </ToolbarButton>
        </div>
      )}
      <EditorContent editor={editor} />
    </div>
  );
}

export default NoteEditor;
