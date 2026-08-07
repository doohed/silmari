import { describe, it, expect } from 'vitest';
import { createAccount } from '@/lib/accounts/signup';
import { getObjectBySlug } from '@/lib/metadata/object-service';
import { createRecord } from '@/lib/records/service';
import {
  createActivity,
  listForRecord,
  listTasks,
  toggleTask,
  updateActivity,
} from '@/lib/activities/service';
import { getStorage } from '@/lib/storage';
import {
  createAttachment,
  listForRecord as listAttachments,
  readAttachment,
} from '@/lib/attachments/service';

async function owner() {
  const { userId, workspaceId } = await createAccount({
    firstName: 'Owner',
    lastName: 'Act',
    email: 'act@test.dev',
    password: 'secret123',
    workspaceName: 'Act Co',
  });
  return { userId, workspaceId, role: 'OWNER' };
}

describe('actividades', () => {
  it('una nota vinculada a dos registros aparece en ambos', async () => {
    const ctx = await owner();
    const [companies, people] = await Promise.all([
      getObjectBySlug(ctx, 'companies'),
      getObjectBySlug(ctx, 'people'),
    ]);
    const acme = await createRecord(ctx, { objectSlug: 'companies', data: { name: 'Acme' } });
    const ada = await createRecord(ctx, {
      objectSlug: 'people',
      data: { name: { firstName: 'Ada', lastName: 'Byron' } },
    });

    const note = await createActivity(ctx, {
      type: 'NOTE',
      title: 'Reunión',
      body: { type: 'doc', content: [] },
      targets: [
        { objectMetadataId: companies.id, recordId: acme.id },
        { objectMetadataId: people.id, recordId: ada.id },
      ],
    });

    const onCompany = await listForRecord(ctx, { recordId: acme.id, type: 'NOTE' });
    const onPerson = await listForRecord(ctx, { recordId: ada.id, type: 'NOTE' });
    expect(onCompany.map((n) => n.id)).toContain(note.id);
    expect(onPerson.map((n) => n.id)).toContain(note.id);
  });

  it('bandeja de tareas: filtros mías/vencidas y toggle', async () => {
    const ctx = await owner();
    const companies = await getObjectBySlug(ctx, 'companies');
    const acme = await createRecord(ctx, { objectSlug: 'companies', data: { name: 'Acme' } });

    const overdue = await createActivity(ctx, {
      type: 'TASK',
      title: 'Llamar',
      dueAt: '2020-01-01T00:00:00.000Z',
      targets: [{ objectMetadataId: companies.id, recordId: acme.id }],
    });

    // Sin responsables explícitos (array vacío) → se asigna al creador y sale en "Mías".
    const auto = await createActivity(ctx, {
      type: 'TASK',
      title: 'Sin responsable explícito',
      assigneeIds: [],
      targets: [{ objectMetadataId: companies.id, recordId: acme.id }],
    });
    expect(auto.assigneeIds).toEqual([String(ctx.userId)]);
    expect((await listTasks(ctx, { scope: 'mine' })).map((t) => t.id)).toContain(auto.id);

    expect((await listTasks(ctx, { scope: 'all' })).length).toBe(2);
    expect((await listTasks(ctx, { scope: 'mine' })).length).toBe(2);
    expect((await listTasks(ctx, { scope: 'overdue' })).map((t) => t.id)).toContain(overdue.id);

    await toggleTask(ctx, overdue.id);
    // Ya hecha: no cuenta como vencida.
    expect((await listTasks(ctx, { scope: 'overdue' })).length).toBe(0);
  });

  it('tarea suelta (sin registro), varios responsables y rango de calendario', async () => {
    const ctx = await owner();
    // Segundo miembro para asignar.
    const other = await createAccount({
      firstName: 'Otro',
      lastName: 'Miembro',
      email: 'otro-act@test.dev',
      password: 'secret123',
      workspaceName: 'X',
    });

    // Tarea suelta (sin targets) con fecha y dos responsables.
    const task = await createActivity(ctx, {
      type: 'TASK',
      title: 'Planificar sprint',
      dueAt: '2030-06-15T12:00:00.000Z',
      assigneeIds: [ctx.userId, other.userId],
    });
    expect(task.targets).toHaveLength(0);
    expect(task.assigneeIds).toEqual([String(ctx.userId), String(other.userId)]);
    expect(task.assignees.map((a) => a.label)).toContain('Owner Act');

    // Rango de calendario: solo tareas con dueAt dentro del mes.
    const inRange = await listTasks(ctx, { from: '2030-06-01', to: '2030-07-01' });
    expect(inRange.map((t) => t.id)).toContain(task.id);
    const outRange = await listTasks(ctx, { from: '2030-07-01', to: '2030-08-01' });
    expect(outRange.map((t) => t.id)).not.toContain(task.id);

    // Editar responsables.
    const updated = await updateActivity(ctx, task.id, { assigneeIds: [other.userId] });
    expect(updated.assigneeIds).toEqual([String(other.userId)]);
  });

  it('adjuntos: subir, listar y leer', async () => {
    const ctx = await owner();
    const companies = await getObjectBySlug(ctx, 'companies');
    const acme = await createRecord(ctx, { objectSlug: 'companies', data: { name: 'Acme' } });

    const { key, size } = await getStorage().put({
      workspaceId: ctx.workspaceId,
      filename: 'hola.txt',
      buffer: Buffer.from('hola mundo'),
    });
    const att = await createAttachment(ctx, {
      name: 'hola.txt',
      mimeType: 'text/plain',
      size,
      storageKey: key,
      targets: [{ objectMetadataId: companies.id, recordId: acme.id }],
    });

    const list = await listAttachments(ctx, { recordId: acme.id });
    expect(list.map((a) => a.id)).toContain(att.id);

    const read = await readAttachment(ctx, att.id);
    expect(read.buffer.toString()).toBe('hola mundo');
  });
});
