import { requireContext } from '@/lib/auth/dal';
import { TasksInbox } from '@/components/activities/TasksInbox';

export const metadata = { title: 'Tareas · Silmari' };

export default async function TasksPage() {
  await requireContext();
  return <TasksInbox />;
}
