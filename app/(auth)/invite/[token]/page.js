import { getInvitationByToken } from '@/lib/invitations/service';
import { AcceptInviteForm } from './AcceptInviteForm';

export const metadata = { title: 'Invitación · Silmari' };

export default async function InvitePage({ params }) {
  // En Next 16, params es una Promise.
  const { token } = await params;

  let invite;
  try {
    invite = await getInvitationByToken(token);
  } catch (err) {
    return (
      <div className="text-center">
        <h1 className="text-primary mb-1 text-base font-semibold">Invitación no válida</h1>
        <p className="text-secondary text-xs">{err?.message ?? 'El enlace no es válido'}</p>
      </div>
    );
  }

  return (
    <div>
      <h1 className="text-primary mb-1 text-base font-semibold">
        Te han invitado a {invite.workspaceName}
      </h1>
      <p className="text-secondary mb-6 text-xs">
        Como <span className="text-primary font-medium">{invite.email}</span>
      </p>
      <AcceptInviteForm token={token} invite={invite} />
    </div>
  );
}
