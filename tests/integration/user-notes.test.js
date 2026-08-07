import { describe, it, expect } from 'vitest';
import mongoose from 'mongoose';
import { createAccount } from '@/lib/accounts/signup';
import {
  listUserNotes,
  createUserNote,
  updateUserNote,
  deleteUserNote,
} from '@/lib/user-notes/service';

async function ownerCtx(email = 'notes-owner@test.dev') {
  const { userId, workspaceId } = await createAccount({
    firstName: 'Owner',
    lastName: 'Notes',
    email,
    password: 'secret123',
    workspaceName: 'Notas Co',
  });
  return { userId, workspaceId, role: 'OWNER' };
}

describe('apuntes personales (UserNote)', () => {
  it('crea, lista, edita y borra (soft) apuntes del usuario', async () => {
    const ctx = await ownerCtx();

    const a = await createUserNote(ctx, { title: 'Ideas', body: { t: 1 } });
    await createUserNote(ctx, { title: 'Pendientes' });
    let list = await listUserNotes(ctx);
    expect(list).toHaveLength(2);

    // Fijar ordena primero.
    await updateUserNote(ctx, a.id, { pinned: true, title: 'Ideas ✦' });
    list = await listUserNotes(ctx);
    expect(list[0].id).toBe(a.id);
    expect(list[0].pinned).toBe(true);
    expect(list[0].title).toBe('Ideas ✦');

    await deleteUserNote(ctx, a.id);
    list = await listUserNotes(ctx);
    expect(list).toHaveLength(1);
    expect(list.map((n) => n.id)).not.toContain(a.id);
  });

  it('son privados: otro usuario del mismo workspace no los ve', async () => {
    const ctx = await ownerCtx('notes-priv@test.dev');
    await createUserNote(ctx, { title: 'Secreto' });

    const otherUserCtx = {
      userId: String(new mongoose.Types.ObjectId()),
      workspaceId: ctx.workspaceId,
      role: 'MEMBER',
    };
    const seen = await listUserNotes(otherUserCtx);
    expect(seen).toHaveLength(0);
  });
});
