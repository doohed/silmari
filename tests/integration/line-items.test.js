import { describe, it, expect } from 'vitest';
import { createAccount } from '@/lib/accounts/signup';
import { getObjectBySlug } from '@/lib/metadata/object-service';
import { createField } from '@/lib/metadata/field-service';
import { createRecord, getRecord } from '@/lib/records/service';
import { quoteTotals } from '@/lib/quotes/calc';

let seq = 0;

async function owner() {
  seq += 1;
  const { userId, workspaceId } = await createAccount({
    firstName: 'Line',
    lastName: 'Items',
    email: `lines${seq}@test.dev`,
    password: 'secret123',
    workspaceName: `Lines Co ${seq}`,
  });
  return { userId, workspaceId, role: 'OWNER' };
}

async function withLinesField(ctx) {
  const opps = await getObjectBySlug(ctx, 'opportunities');
  await createField(ctx, {
    objectMetadataId: opps.id,
    name: 'lines',
    label: 'Líneas',
    type: 'LINE_ITEMS',
  });
}

describe('campo LINE_ITEMS', () => {
  it('guarda y normaliza las líneas de un registro', async () => {
    const ctx = await owner();
    await withLinesField(ctx);
    const rec = await createRecord(ctx, {
      objectSlug: 'opportunities',
      data: {
        name: 'Cotización 1',
        lines: [
          { description: 'Consultoría', quantity: 2, unitPrice: 100, discount: 10 },
          { description: 'Soporte', quantity: 1, unitPrice: 50, discount: 0 },
        ],
      },
    });

    const got = await getRecord(ctx, { objectSlug: 'opportunities', recordId: rec.id });
    expect(got.data.lines).toHaveLength(2);
    expect(got.data.lines[0]).toMatchObject({
      description: 'Consultoría',
      quantity: 2,
      unitPrice: 100,
      discount: 10,
    });
    // 2×100×0.9 (180) + 1×50 (50) = 230
    expect(quoteTotals(got.data.lines).total).toBe(230);
  });

  it('un registro sin líneas queda con lista vacía', async () => {
    const ctx = await owner();
    await withLinesField(ctx);
    const rec = await createRecord(ctx, {
      objectSlug: 'opportunities',
      data: { name: 'Sin líneas' },
    });
    const got = await getRecord(ctx, { objectSlug: 'opportunities', recordId: rec.id });
    expect(got.data.lines ?? []).toHaveLength(0);
  });
});
