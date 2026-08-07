import { describe, it, expect } from 'vitest';
import { createAccount } from '@/lib/accounts/signup';
import { getObjectBySlug } from '@/lib/metadata/object-service';
import { createRecord, updateRecord } from '@/lib/records/service';
import { getRelatedRecords } from '@/lib/relations/service';
import { listTimelineReadable } from '@/lib/timeline/readable';

async function owner() {
  const { userId, workspaceId } = await createAccount({
    firstName: 'Owner',
    lastName: 'Det',
    email: 'det@test.dev',
    password: 'secret123',
    workspaceName: 'Det Co',
  });
  return { userId, workspaceId, role: 'OWNER' };
}

describe('ficha de registro', () => {
  it('relaciones inversas: los contactos de una empresa aparecen en su ficha', async () => {
    const ctx = await owner();
    const companies = await getObjectBySlug(ctx, 'companies');
    const acme = await createRecord(ctx, { objectSlug: 'companies', data: { name: 'Acme' } });
    const person = await createRecord(ctx, {
      objectSlug: 'people',
      data: { name: { firstName: 'Ada', lastName: 'Byron' }, company: acme.id },
    });

    const sections = await getRelatedRecords(ctx, {
      objectMetadataId: companies.id,
      recordId: acme.id,
    });
    const peopleSection = sections.find((s) => s.sourceObject.slug === 'people');
    expect(peopleSection).toBeTruthy();
    expect(peopleSection.records.map((r) => r.id)).toContain(person.id);
    expect(peopleSection.records[0].label).toBe('Ada Byron');
  });

  it('desvincular quita el registro de la relación inversa', async () => {
    const ctx = await owner();
    const companies = await getObjectBySlug(ctx, 'companies');
    const acme = await createRecord(ctx, { objectSlug: 'companies', data: { name: 'Acme' } });
    const person = await createRecord(ctx, {
      objectSlug: 'people',
      data: { name: { firstName: 'Ada', lastName: 'Byron' }, company: acme.id },
    });

    await updateRecord(ctx, { objectSlug: 'people', recordId: person.id, data: { company: null } });

    const sections = await getRelatedRecords(ctx, {
      objectMetadataId: companies.id,
      recordId: acme.id,
    });
    const peopleSection = sections.find((s) => s.sourceObject.slug === 'people');
    expect(peopleSection.records).toHaveLength(0);
  });

  it('timeline legible: describe cambios en lenguaje humano', async () => {
    const ctx = await owner();
    const acme = await createRecord(ctx, { objectSlug: 'companies', data: { name: 'Acme' } });
    await updateRecord(ctx, {
      objectSlug: 'companies',
      recordId: acme.id,
      data: { employees: 10 },
    });

    const timeline = await listTimelineReadable(ctx, {
      objectSlug: 'companies',
      recordId: acme.id,
    });
    const events = timeline.map((t) => t.event);
    expect(events).toContain('created');
    const updated = timeline.find((t) => t.event === 'updated');
    expect(updated.text).toMatch(/cambió Empleados de vacío a 10/i);
    // El autor del cambio se muestra con el nombre del usuario.
    expect(updated.actorName).toBe('Owner Det');
  });

  it('timeline legible resuelve el label de una relación', async () => {
    const ctx = await owner();
    const acme = await createRecord(ctx, { objectSlug: 'companies', data: { name: 'Acme' } });
    const person = await createRecord(ctx, {
      objectSlug: 'people',
      data: { name: { firstName: 'Ada', lastName: 'Byron' } },
    });
    await updateRecord(ctx, {
      objectSlug: 'people',
      recordId: person.id,
      data: { company: acme.id },
    });

    const timeline = await listTimelineReadable(ctx, { objectSlug: 'people', recordId: person.id });
    const updated = timeline.find((t) => t.event === 'updated');
    expect(updated.text).toMatch(/cambió Empresa de vacío a Acme/i);
  });
});
