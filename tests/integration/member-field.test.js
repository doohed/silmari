import { describe, it, expect } from 'vitest';
import { createAccount } from '@/lib/accounts/signup';
import { createRecord, updateRecord } from '@/lib/records/service';
import { getObjectBySlug } from '@/lib/metadata/object-service';
import { createField } from '@/lib/metadata/field-service';

async function ownerCtx(email = 'member-field@test.dev') {
  const { userId, workspaceId } = await createAccount({
    firstName: 'Ana',
    lastName: 'Referida',
    email,
    password: 'secret123',
    workspaceName: 'Ref Co',
  });
  return { userId, workspaceId, role: 'OWNER' };
}

/** Crea un campo MEMBER "owner" en el objeto Empresas (ya no hay MEMBER estándar). */
async function withMemberField(ctx) {
  const companies = await getObjectBySlug(ctx, 'companies');
  await createField(ctx, {
    objectMetadataId: companies.id,
    name: 'owner',
    label: 'Responsable',
    type: 'MEMBER',
  });
}

describe('campo MEMBER', () => {
  it('por defecto se rellena con el creador y se hidrata con su nombre', async () => {
    const ctx = await ownerCtx('member-default@test.dev');
    await withMemberField(ctx);
    const company = await createRecord(ctx, { objectSlug: 'companies', data: { name: 'Acme' } });

    expect(company.data.owner).toBe(ctx.userId);
    expect(company.relations.owner).toEqual({
      id: ctx.userId,
      label: 'Ana Referida',
      avatarUrl: null,
    });
  });

  it('es editable: se puede vaciar', async () => {
    const ctx = await ownerCtx('member-edit@test.dev');
    await withMemberField(ctx);
    const company = await createRecord(ctx, { objectSlug: 'companies', data: { name: 'Beta' } });
    const updated = await updateRecord(ctx, {
      objectSlug: 'companies',
      recordId: company.id,
      data: { owner: null },
    });
    expect(updated.data.owner ?? null).toBeNull();
    expect(updated.relations.owner).toBeNull();
  });

  it('desde una API key no se autorrellena el miembro', async () => {
    const ctx = await ownerCtx('member-api@test.dev');
    await withMemberField(ctx);
    const apiCtx = { ...ctx, userId: 'apikey:deadbeef', source: 'API' };
    const company = await createRecord(apiCtx, {
      objectSlug: 'companies',
      data: { name: 'Gamma' },
      source: 'API',
    });
    expect(company.data.owner ?? null).toBeNull();
  });
});
