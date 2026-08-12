import { describe, it, expect } from 'vitest';
import { createAccount } from '@/lib/accounts/signup';
import { createRecord, getRecord, bulkUpdateRecords } from '@/lib/records/service';

let seq = 0;

async function owner() {
  seq += 1;
  const { userId, workspaceId } = await createAccount({
    firstName: 'Bulk',
    lastName: 'Edit',
    email: `bulk${seq}@test.dev`,
    password: 'secret123',
    workspaceName: `Bulk Co ${seq}`,
  });
  return { userId, workspaceId, role: 'OWNER' };
}

async function threeCompanies(ctx) {
  const ids = [];
  for (const name of ['A', 'B', 'C']) {
    const r = await createRecord(ctx, { objectSlug: 'companies', data: { name } });
    ids.push(r.id);
  }
  return ids;
}

describe('edición masiva', () => {
  it('fija un mismo campo en varios registros', async () => {
    const ctx = await owner();
    const ids = await threeCompanies(ctx);

    const res = await bulkUpdateRecords(ctx, {
      objectSlug: 'companies',
      recordIds: ids,
      fieldName: 'industry',
      value: 'Software',
    });
    expect(res.updated).toBe(3);

    for (const id of ids) {
      const got = await getRecord(ctx, { objectSlug: 'companies', recordId: id });
      expect(got.data.industry).toBe('Software');
    }
  });

  it('valida el valor contra la metadata (rechaza un tipo incorrecto)', async () => {
    const ctx = await owner();
    const ids = await threeCompanies(ctx);
    // employees es NUMBER: un objeto no es un número válido.
    await expect(
      bulkUpdateRecords(ctx, {
        objectSlug: 'companies',
        recordIds: ids,
        fieldName: 'employees',
        value: { no: 'numérico' },
      }),
    ).rejects.toThrow();
  });

  it('exige un campo', async () => {
    const ctx = await owner();
    const ids = await threeCompanies(ctx);
    await expect(
      bulkUpdateRecords(ctx, { objectSlug: 'companies', recordIds: ids, value: 'x' }),
    ).rejects.toThrow();
  });

  it('no toca registros de otro workspace (ids ajenos → NotFound)', async () => {
    const a = await owner();
    const b = await owner();
    const [foreignId] = await threeCompanies(b);
    await expect(
      bulkUpdateRecords(a, {
        objectSlug: 'companies',
        recordIds: [foreignId],
        fieldName: 'industry',
        value: 'X',
      }),
    ).rejects.toThrow();
  });
});
