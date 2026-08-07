import { requireContext } from '@/lib/auth/dal';
import { getAccountProfile } from '@/lib/accounts/profile';
import { ProfileForm } from '@/components/settings/ProfileForm';

export const metadata = { title: 'Perfil · Silmari' };

export default async function ProfilePage() {
  const ctx = await requireContext();
  const account = await getAccountProfile(ctx);
  return (
    <div className="mx-auto max-w-2xl px-8 py-8">
      <h1 className="text-primary mb-6 text-xl font-semibold tracking-tight">Perfil</h1>
      <ProfileForm account={account} />
    </div>
  );
}
