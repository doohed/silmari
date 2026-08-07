import { requireContext } from '@/lib/auth/dal';
import { NotesInbox } from '@/components/notes/NotesInbox';

export const metadata = { title: 'Apuntes · Silmari' };

export default async function NotesPage() {
  await requireContext();
  return <NotesInbox />;
}
