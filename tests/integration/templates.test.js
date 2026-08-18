import { describe, it, expect } from 'vitest';
import { createAccount } from '@/lib/accounts/signup';
import { getObjectBySlug } from '@/lib/metadata/object-service';
import { createRecord } from '@/lib/records/service';
import {
  createTemplate,
  listTemplates,
  listTemplatesForCompose,
  updateTemplate,
  deleteTemplate,
  renderForRecord,
  buildRecordVariables,
} from '@/lib/templates/service';

let seq = 0;

async function owner() {
  seq += 1;
  const { userId, workspaceId } = await createAccount({
    firstName: 'Temp',
    lastName: 'Late',
    email: `tpl${seq}@test.dev`,
    password: 'secret123',
    workspaceName: `Tpl Co ${seq}`,
  });
  return { userId, workspaceId, role: 'OWNER', actorName: 'Temp Late' };
}

describe('plantillas · CRUD y permisos', () => {
  it('un MEMBER no puede gestionarlas', async () => {
    const ctx = await owner();
    const mem = { ...ctx, role: 'MEMBER' };
    await expect(listTemplates(mem)).rejects.toThrow();
    await expect(createTemplate(mem, { name: 'x', body: 'hola' })).rejects.toThrow();
  });

  it('exige nombre y cuerpo', async () => {
    const ctx = await owner();
    await expect(createTemplate(ctx, { name: '', body: 'hola' })).rejects.toThrow(/nombre/i);
    await expect(createTemplate(ctx, { name: 'x', body: '' })).rejects.toThrow(/cuerpo/i);
  });

  it('crea, lista, actualiza y borra', async () => {
    const ctx = await owner();
    const t = await createTemplate(ctx, {
      name: 'Bienvenida',
      channel: 'EMAIL',
      subject: 'Hola {{name}}',
      body: 'Gracias por unirte',
    });
    expect(t.channel).toBe('EMAIL');
    expect(await listTemplates(ctx)).toHaveLength(1);

    const up = await updateTemplate(ctx, t.id, { body: 'Actualizado' });
    expect(up.body).toBe('Actualizado');

    await deleteTemplate(ctx, t.id);
    expect(await listTemplates(ctx)).toHaveLength(0);
  });

  it('un MEMBER puede listarlas para redactar (sin gate de admin) y filtrar por canal', async () => {
    const ctx = await owner();
    await createTemplate(ctx, { name: 'Email', channel: 'EMAIL', body: 'hola' });
    await createTemplate(ctx, { name: 'WA', channel: 'WHATSAPP', body: 'hola' });
    const mem = { ...ctx, role: 'MEMBER' };
    expect(await listTemplatesForCompose(mem)).toHaveLength(2);
    const onlyWa = await listTemplatesForCompose(mem, { channel: 'WHATSAPP' });
    expect(onlyWa).toHaveLength(1);
    expect(onlyWa[0].name).toBe('WA');
  });

  it('un canal no-EMAIL no guarda asunto', async () => {
    const ctx = await owner();
    const t = await createTemplate(ctx, {
      name: 'WA',
      channel: 'WHATSAPP',
      subject: 'no debería guardarse',
      body: 'Hola',
    });
    expect(t.subject).toBe('');
  });
});

describe('plantillas · render contra registro', () => {
  it('rellena las variables con los datos del registro', async () => {
    const ctx = await owner();
    const record = await createRecord(ctx, {
      objectSlug: 'companies',
      data: { name: 'Acme', industry: 'Tecnología' },
    });
    const t = await createTemplate(ctx, {
      name: 'Saludo',
      channel: 'EMAIL',
      objectSlug: 'companies',
      subject: 'Hola {{name}}',
      body: 'Sois del sector {{industry}}. — {{actor.name}}',
    });

    const out = await renderForRecord(ctx, {
      templateId: t.id,
      objectSlug: 'companies',
      recordId: record.id,
    });
    expect(out.subject).toBe('Hola Acme');
    expect(out.body).toBe('Sois del sector Tecnología. — Temp Late');
  });

  it('buildRecordVariables pasa cada campo por su toSearchText', async () => {
    const ctx = await owner();
    const object = await getObjectBySlug(ctx, 'companies');
    const record = await createRecord(ctx, {
      objectSlug: 'companies',
      data: { name: 'Globex', employees: 42 },
    });
    const vars = buildRecordVariables(object, record, ctx);
    expect(vars.name).toBe('Globex');
    expect(vars.employees).toBe('42');
    expect(vars['actor.name']).toBe('Temp Late');
  });
});
