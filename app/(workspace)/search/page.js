import { requireContext } from '@/lib/auth/dal';
import { SearchPage } from '@/components/search/SearchPage';

export const metadata = { title: 'Buscar · Silmari' };

export default async function Search() {
  await requireContext();
  return <SearchPage />;
}
