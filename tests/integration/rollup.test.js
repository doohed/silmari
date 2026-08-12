import { describe, it, expect } from 'vitest';
import { createAccount } from '@/lib/accounts/signup';
import { getObjectBySlug } from '@/lib/metadata/object-service';
import { createField } from '@/lib/metadata/field-service';
import { createRecord, getRecord, softDeleteRecord } from '@/lib/records/service';

let seq = 0;

async function owner() {
  seq += 1;
  const { userId, workspaceId } = await createAccount({
    firstName: 'Roll',
    lastName: 'Up',
    email: `rollup${seq}@test.dev`,
    password: 'secret123',
    workspaceName: `Rollup Co ${seq}`,
  });
  return { userId, workspaceId, role: 'OWNER' };
}

/** Crea un ROLLUP en `companies` que agrega las oportunidades vía su relación `company`. */
async function addRollup(ctx, { operation, aggregateFieldName }) {
  const companies = await getObjectBySlug(ctx, 'companies');
  const opps = await getObjectBySlug(ctx, 'opportunities');
  const relField = opps.fields.find((f) => f.name === 'company' && f.type === 'RELATION');
  const field = await createField(ctx, {
    objectMetadataId: companies.id,
    name: `${operation}Opps`,
    label: `Rollup ${operation}`,
    type: 'ROLLUP',
    settings: {
      rollup: {
        relationFieldId: relField.id,
        operation,
        ...(aggregateFieldName ? { aggregateFieldName } : {}),
      },
    },
  });
  return field;
}

const money = (n) => ({ amount: n, currencyCode: 'EUR' });

describe('campo ROLLUP', () => {
  it('suma el monto de las oportunidades relacionadas', async () => {
    const ctx = await owner();
    const rollup = await addRollup(ctx, { operation: 'sum', aggregateFieldName: 'amount' });
    const company = await createRecord(ctx, { objectSlug: 'companies', data: { name: 'Acme' } });
    await createRecord(ctx, {
      objectSlug: 'opportunities',
      data: { name: 'O1', amount: money(100), company: company.id },
    });
    await createRecord(ctx, {
      objectSlug: 'opportunities',
      data: { name: 'O2', amount: money(250), company: company.id },
    });

    const got = await getRecord(ctx, { objectSlug: 'companies', recordId: company.id });
    expect(got.data[rollup.name]).toBe(350);
  });

  it('cuenta las oportunidades relacionadas', async () => {
    const ctx = await owner();
    const rollup = await addRollup(ctx, { operation: 'count' });
    const company = await createRecord(ctx, { objectSlug: 'companies', data: { name: 'Beta' } });
    for (const name of ['A', 'B', 'C']) {
      await createRecord(ctx, {
        objectSlug: 'opportunities',
        data: { name, company: company.id },
      });
    }
    const got = await getRecord(ctx, { objectSlug: 'companies', recordId: company.id });
    expect(got.data[rollup.name]).toBe(3);
  });

  it('no cuenta las oportunidades de otra empresa', async () => {
    const ctx = await owner();
    const rollup = await addRollup(ctx, { operation: 'count' });
    const a = await createRecord(ctx, { objectSlug: 'companies', data: { name: 'A' } });
    const b = await createRecord(ctx, { objectSlug: 'companies', data: { name: 'B' } });
    await createRecord(ctx, {
      objectSlug: 'opportunities',
      data: { name: 'x', company: a.id },
    });
    const gotB = await getRecord(ctx, { objectSlug: 'companies', recordId: b.id });
    expect(gotB.data[rollup.name]).toBe(0);
  });

  it('excluye del agregado las oportunidades borradas (soft delete)', async () => {
    const ctx = await owner();
    const rollup = await addRollup(ctx, { operation: 'sum', aggregateFieldName: 'amount' });
    const company = await createRecord(ctx, { objectSlug: 'companies', data: { name: 'Gamma' } });
    const keep = await createRecord(ctx, {
      objectSlug: 'opportunities',
      data: { name: 'keep', amount: money(100), company: company.id },
    });
    const drop = await createRecord(ctx, {
      objectSlug: 'opportunities',
      data: { name: 'drop', amount: money(999), company: company.id },
    });
    await softDeleteRecord(ctx, { objectSlug: 'opportunities', recordId: drop.id });

    const got = await getRecord(ctx, { objectSlug: 'companies', recordId: company.id });
    expect(got.data[rollup.name]).toBe(100);
    expect(keep.id).toBeTruthy();
  });

  it('rechaza un ROLLUP no-count sin campo numérico', async () => {
    const ctx = await owner();
    const companies = await getObjectBySlug(ctx, 'companies');
    const opps = await getObjectBySlug(ctx, 'opportunities');
    const relField = opps.fields.find((f) => f.name === 'company');
    await expect(
      createField(ctx, {
        objectMetadataId: companies.id,
        name: 'badRollup',
        label: 'Bad',
        type: 'ROLLUP',
        settings: { rollup: { relationFieldId: relField.id, operation: 'sum' } },
      }),
    ).rejects.toThrow();
  });
});
