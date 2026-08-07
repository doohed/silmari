import { describe, it, expect } from 'vitest';
import { createAccount } from '@/lib/accounts/signup';
import {
  createRecord,
  getRecord,
  listRecords,
  updateRecord,
  moveRecord,
  reorderRecords,
  softDeleteRecord,
  restoreRecord,
} from '@/lib/records/service';
import { generateKeyBetween } from 'fractional-indexing';
import { listTimeline } from '@/lib/timeline/service';

async function owner() {
  const { userId, workspaceId } = await createAccount({
    firstName: 'Owner',
    lastName: 'Rec',
    email: 'rec@test.dev',
    password: 'secret123',
    workspaceName: 'Rec Co',
  });
  return { userId, workspaceId, role: 'OWNER' };
}

describe('capa genérica de registros', () => {
  it('crea, lee y valida contra la metadata', async () => {
    const ctx = await owner();
    const rec = await createRecord(ctx, {
      objectSlug: 'companies',
      data: { name: 'Acme', employees: 10 },
    });
    expect(rec.id).toBeTruthy();
    expect(rec.data.name).toBe('Acme');

    const got = await getRecord(ctx, { objectSlug: 'companies', recordId: rec.id });
    expect(got.data.employees).toBe(10);

    // Campo desconocido → error.
    await expect(
      createRecord(ctx, { objectSlug: 'companies', data: { noExiste: 1, name: 'X' } }),
    ).rejects.toThrow(/reconocido|válid/i);

    // Sin el identificador TEXT: se rellena "Sin título" (creación rápida).
    const auto = await createRecord(ctx, { objectSlug: 'companies', data: { employees: 3 } });
    expect(auto.data.name).toBe('Sin título');
  });

  it('proyección de columnas: solo devuelve los campos pedidos', async () => {
    const ctx = await owner();
    await createRecord(ctx, {
      objectSlug: 'companies',
      data: { name: 'Proj', employees: 42, industry: 'SaaS' },
    });

    const { records } = await listRecords(ctx, { objectSlug: 'companies', fieldNames: ['name'] });
    expect(records[0].data.name).toBe('Proj');
    expect(records[0].data.employees).toBeUndefined(); // no pedido → proyectado fuera
    expect(records[0].data.industry).toBeUndefined();
    // La raíz imprescindible sigue viajando (posición, creado por…).
    expect(typeof records[0].position).toBe('string');
  });

  it('proyección: ordena/pagina por un campo oculto (viaja para el cursor)', async () => {
    const ctx = await owner();
    for (const n of [1, 2, 3]) {
      await createRecord(ctx, { objectSlug: 'companies', data: { name: `P${n}`, employees: n * 10 } });
    }
    const args = {
      objectSlug: 'companies',
      fieldNames: ['name'], // "employees" no es visible, pero es el orden
      sorts: [{ fieldName: 'employees', direction: 'desc' }],
      limit: 2,
    };
    const page1 = await listRecords(ctx, args);
    expect(page1.records.map((r) => r.data.name)).toEqual(['P3', 'P2']);
    expect(page1.hasMore).toBe(true);

    const page2 = await listRecords(ctx, { ...args, cursor: page1.nextCursor });
    expect(page2.records.map((r) => r.data.name)).toEqual(['P1']);
  });

  it('filtra y pagina por cursor', async () => {
    const ctx = await owner();
    for (const n of [1, 2, 3]) {
      await createRecord(ctx, {
        objectSlug: 'companies',
        data: { name: `C${n}`, employees: n * 10 },
      });
    }

    const filtered = await listRecords(ctx, {
      objectSlug: 'companies',
      filters: [{ fieldName: 'employees', operator: 'gte', value: '20' }],
    });
    expect(filtered.records).toHaveLength(2);

    const page1 = await listRecords(ctx, {
      objectSlug: 'companies',
      sorts: [{ fieldName: 'employees', direction: 'asc' }],
      limit: 2,
    });
    expect(page1.records).toHaveLength(2);
    expect(page1.hasMore).toBe(true);
    expect(page1.records[0].data.employees).toBe(10);

    const page2 = await listRecords(ctx, {
      objectSlug: 'companies',
      sorts: [{ fieldName: 'employees', direction: 'asc' }],
      limit: 2,
      cursor: page1.nextCursor,
    });
    expect(page2.records).toHaveLength(1);
    expect(page2.records[0].data.employees).toBe(30);
  });

  it('sin orden de columna lista por `position` y se reordena arrastrando', async () => {
    const ctx = await owner();
    const created = [];
    for (const n of [1, 2, 3]) {
      created.push(
        await createRecord(ctx, { objectSlug: 'companies', data: { name: `Orden ${n}` } }),
      );
    }

    // Orden por defecto = manual (`position`), que es el orden de creación.
    let list = await listRecords(ctx, { objectSlug: 'companies' });
    expect(list.records.map((r) => r.data.name)).toEqual(['Orden 1', 'Orden 2', 'Orden 3']);
    expect(list.records.every((r) => typeof r.position === 'string')).toBe(true);

    // Mover el último (Orden 3) al principio, como haría el arrastre en la tabla.
    const beforeFirst = generateKeyBetween(null, list.records[0].position);
    await moveRecord(ctx, {
      objectSlug: 'companies',
      recordId: created[2].id,
      position: beforeFirst,
    });

    list = await listRecords(ctx, { objectSlug: 'companies' });
    expect(list.records.map((r) => r.data.name)).toEqual(['Orden 3', 'Orden 1', 'Orden 2']);
  });

  it('"Creado por" (ACTOR) se hidrata con el usuario; el origen SYSTEM queda como Sistema', async () => {
    const ctx = await owner();
    const mine = await createRecord(ctx, {
      objectSlug: 'opportunities',
      data: { name: 'Trato mío' },
    });
    expect(mine.createdBy.userId).toBe(ctx.userId);
    expect(mine.createdBy.source).toBe('MANUAL');
    expect(mine.createdBy.name).toBe('Owner Rec'); // nombre hidratado del usuario

    const demo = await createRecord(ctx, {
      objectSlug: 'opportunities',
      data: { name: 'Demo' },
      source: 'SYSTEM',
    });
    expect(demo.createdBy.source).toBe('SYSTEM'); // se mostrará como "Sistema"
  });

  it('reorderRecords hornea un orden manual desde una lista de ids', async () => {
    const ctx = await owner();
    const a = await createRecord(ctx, { objectSlug: 'companies', data: { name: 'A' } });
    const b = await createRecord(ctx, { objectSlug: 'companies', data: { name: 'B' } });
    const c = await createRecord(ctx, { objectSlug: 'companies', data: { name: 'C' } });

    let list = await listRecords(ctx, { objectSlug: 'companies' });
    expect(list.records.map((r) => r.data.name)).toEqual(['A', 'B', 'C']);

    await reorderRecords(ctx, { objectSlug: 'companies', orderedIds: [c.id, a.id, b.id] });

    list = await listRecords(ctx, { objectSlug: 'companies' });
    expect(list.records.map((r) => r.data.name)).toEqual(['C', 'A', 'B']);
  });

  it('actualiza y registra el diff en el timeline', async () => {
    const ctx = await owner();
    const rec = await createRecord(ctx, {
      objectSlug: 'companies',
      data: { name: 'Init', employees: 1 },
    });
    await updateRecord(ctx, {
      objectSlug: 'companies',
      recordId: rec.id,
      data: { employees: 99 },
    });

    const got = await getRecord(ctx, { objectSlug: 'companies', recordId: rec.id });
    expect(got.data.employees).toBe(99);
    expect(got.data.name).toBe('Init'); // el patch no toca lo no enviado

    const timeline = await listTimeline(ctx, rec.id);
    const events = timeline.map((t) => t.event);
    expect(events).toContain('created');
    expect(events).toContain('updated');
    const updated = timeline.find((t) => t.event === 'updated');
    expect(updated.diff.employees).toEqual({ before: 1, after: 99 });
  });

  it('soft delete y restore', async () => {
    const ctx = await owner();
    const rec = await createRecord(ctx, { objectSlug: 'companies', data: { name: 'Temp' } });

    await softDeleteRecord(ctx, { objectSlug: 'companies', recordId: rec.id });
    const afterDelete = await listRecords(ctx, { objectSlug: 'companies' });
    expect(afterDelete.records.find((r) => r.id === rec.id)).toBeUndefined();
    await expect(getRecord(ctx, { objectSlug: 'companies', recordId: rec.id })).rejects.toThrow();

    await restoreRecord(ctx, { objectSlug: 'companies', recordId: rec.id });
    const restored = await getRecord(ctx, { objectSlug: 'companies', recordId: rec.id });
    expect(restored.data.name).toBe('Temp');
  });

  it('hidrata relaciones MANY_TO_ONE con el labelIdentifier del destino', async () => {
    const ctx = await owner();
    const acme = await createRecord(ctx, { objectSlug: 'companies', data: { name: 'Acme' } });
    const person = await createRecord(ctx, {
      objectSlug: 'people',
      data: { name: { firstName: 'Ada', lastName: 'Byron' }, company: acme.id },
    });

    const got = await getRecord(ctx, { objectSlug: 'people', recordId: person.id });
    expect(got.relations.company).toEqual({ id: acme.id, label: 'Acme' });
  });
});
