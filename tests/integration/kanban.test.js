import { describe, it, expect } from 'vitest';
import { createAccount } from '@/lib/accounts/signup';
import { getObjectViews } from '@/lib/views/service';
import { getObjectBySlug } from '@/lib/metadata/object-service';
import { createRecord, listBoardColumn, columnAggregates, moveRecord } from '@/lib/records/service';
import { listTimelineReadable as readable } from '@/lib/timeline/readable';

async function owner() {
  const { userId, workspaceId } = await createAccount({
    firstName: 'Owner',
    lastName: 'Kan',
    email: 'kan@test.dev',
    password: 'secret123',
    workspaceName: 'Kan Co',
  });
  return { userId, workspaceId, role: 'OWNER' };
}

async function makeOpp(ctx, name, stage, amount) {
  return createRecord(ctx, {
    objectSlug: 'opportunities',
    data: { name, stage, amount: { amount, currencyCode: 'EUR' } },
  });
}

describe('kanban', () => {
  it('auto-crea una vista KANBAN agrupada por el SELECT', async () => {
    const ctx = await owner();
    const { object, views } = await getObjectViews(ctx, 'opportunities');
    const kanban = views.find((v) => v.type === 'KANBAN');
    expect(kanban).toBeTruthy();
    const stage = object.fields.find((f) => f.name === 'stage');
    expect(kanban.kanbanFieldMetadataId).toBe(stage.id);
  });

  it('lista una columna por opción, ordenada por position', async () => {
    const ctx = await owner();
    await makeOpp(ctx, 'A', 'new', 100);
    await makeOpp(ctx, 'B', 'new', 200);
    await makeOpp(ctx, 'C', 'proposal', 300);

    const col = await listBoardColumn(ctx, {
      objectSlug: 'opportunities',
      groupFieldName: 'stage',
      value: 'new',
    });
    expect(col.records).toHaveLength(2);
    expect(col.records[0].position <= col.records[1].position).toBe(true);
  });

  it('agrega conteo y suma por columna (exacto)', async () => {
    const ctx = await owner();
    await makeOpp(ctx, 'A', 'new', 100);
    await makeOpp(ctx, 'B', 'new', 200);
    await makeOpp(ctx, 'C', 'proposal', 300);

    const agg = await columnAggregates(ctx, {
      objectSlug: 'opportunities',
      groupFieldName: 'stage',
      sumFieldName: 'amount',
    });
    const newAgg = agg.find((a) => a.value === 'new');
    expect(newAgg.count).toBe(2);
    expect(newAgg.sum).toBe(300);
  });

  it('mover cambia la etapa y lo registra en el timeline', async () => {
    const ctx = await owner();
    const opp = await makeOpp(ctx, 'Deal', 'proposal', 500);

    const moved = await moveRecord(ctx, {
      objectSlug: 'opportunities',
      recordId: opp.id,
      position: 'a5',
      patch: { stage: 'won' },
    });
    expect(moved.data.stage).toBe('won');

    const timeline = await readable(ctx, { objectSlug: 'opportunities', recordId: opp.id });
    const updated = timeline.find((t) => t.event === 'updated');
    expect(updated.text).toMatch(/cambió Etapa de Propuesta a Ganada/i);

    // Ya no está en la columna 'proposal'.
    const proposalCol = await listBoardColumn(ctx, {
      objectSlug: 'opportunities',
      groupFieldName: 'stage',
      value: 'proposal',
    });
    expect(proposalCol.records.find((r) => r.id === opp.id)).toBeUndefined();
  });
});
