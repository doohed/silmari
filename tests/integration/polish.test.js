import { describe, it, expect } from 'vitest';
import { createAccount } from '@/lib/accounts/signup';
import {
  createRecord,
  getRecord,
  softDeleteRecord,
  restoreRecord,
  hardDeleteRecord,
  listAllTrash,
  exportRecords,
  importRecords,
} from '@/lib/records/service';

async function owner(suffix = '') {
  const { userId, workspaceId } = await createAccount({
    firstName: 'Owner',
    lastName: 'Pol',
    email: `pol${suffix}@test.dev`,
    password: 'secret123',
    workspaceName: `Pol Co ${suffix}`,
  });
  return { userId, workspaceId, role: 'OWNER' };
}

describe('pulido', () => {
  it('import CSV: crea las válidas e informa de las erróneas', async () => {
    const ctx = await owner('I');
    const res = await importRecords(ctx, {
      objectSlug: 'companies',
      rows: [
        { name: 'Acme', employees: '10' },
        { name: 'Beta', employees: 'no-es-numero' },
      ],
    });
    expect(res.created).toBe(1);
    expect(res.failed).toBe(1);
    expect(res.errors[0].row).toBe(2);
  });

  it('export respeta los filtros', async () => {
    const ctx = await owner('E');
    for (const n of [10, 20, 30]) {
      await createRecord(ctx, { objectSlug: 'companies', data: { name: `C${n}`, employees: n } });
    }
    const { records } = await exportRecords(ctx, {
      objectSlug: 'companies',
      filters: [{ fieldName: 'employees', operator: 'gte', value: '20' }],
    });
    expect(records).toHaveLength(2);
  });

  it('papelera: restaurar y borrado definitivo', async () => {
    const ctx = await owner('T');
    const rec = await createRecord(ctx, { objectSlug: 'companies', data: { name: 'Temp' } });

    await softDeleteRecord(ctx, { objectSlug: 'companies', recordId: rec.id });
    let trash = await listAllTrash(ctx);
    expect(trash.find((g) => g.object.slug === 'companies').records.map((r) => r.id)).toContain(
      rec.id,
    );

    await restoreRecord(ctx, { objectSlug: 'companies', recordId: rec.id });
    expect(await listAllTrash(ctx)).toEqual([]);

    // Borrado definitivo: ya no se puede leer ni restaurar.
    await softDeleteRecord(ctx, { objectSlug: 'companies', recordId: rec.id });
    await hardDeleteRecord(ctx, { objectSlug: 'companies', recordId: rec.id });
    expect(await listAllTrash(ctx)).toEqual([]);
    await expect(getRecord(ctx, { objectSlug: 'companies', recordId: rec.id })).rejects.toThrow();
  });
});
