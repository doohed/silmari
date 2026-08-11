import { describe, it, expect } from 'vitest';
import { createAccount } from '@/lib/accounts/signup';
import { getObjectBySlug } from '@/lib/metadata/object-service';
import { listRecords, getRecord } from '@/lib/records/service';
import {
  createForm,
  listForms,
  toggleForm,
  getPublicForm,
  submitPublicForm,
} from '@/lib/forms/service';

let seq = 0;

async function owner() {
  seq += 1;
  const { userId, workspaceId } = await createAccount({
    firstName: 'Form',
    lastName: 'Owner',
    email: `form${seq}@test.dev`,
    password: 'secret123',
    workspaceName: `Form Co ${seq}`,
  });
  return { userId, workspaceId, role: 'OWNER' };
}

/** Formulario estándar sobre Empresas: name (obligatorio) + industry, dedup por name. */
async function companyForm(ctx, overrides = {}) {
  const companies = await getObjectBySlug(ctx, 'companies');
  return createForm(ctx, {
    name: 'Contacto web',
    objectMetadataId: companies.id,
    fields: [
      { fieldName: 'name', label: 'Nombre', required: true },
      { fieldName: 'industry', label: 'Sector' },
    ],
    dedupeFieldName: 'name',
    ...overrides,
  });
}

async function countCompanies(ctx) {
  const { records } = await listRecords(ctx, { objectSlug: 'companies', limit: 200 });
  return records.length;
}

describe('formularios · CRUD y permisos', () => {
  it('un MEMBER no puede gestionarlos', async () => {
    const ctx = await owner();
    const mem = { ...ctx, role: 'MEMBER' };
    await expect(listForms(mem)).rejects.toThrow();
    const companies = await getObjectBySlug(ctx, 'companies');
    await expect(
      createForm(mem, {
        name: 'x',
        objectMetadataId: companies.id,
        fields: [{ fieldName: 'name' }],
      }),
    ).rejects.toThrow();
  });

  it('valida que los campos existan y sean escribibles', async () => {
    const ctx = await owner();
    const companies = await getObjectBySlug(ctx, 'companies');
    await expect(
      createForm(ctx, {
        name: 'malo',
        objectMetadataId: companies.id,
        fields: [{ fieldName: 'noExiste' }],
      }),
    ).rejects.toThrow(/desconocido/i);
    await expect(
      createForm(ctx, { name: 'vacío', objectMetadataId: companies.id, fields: [] }),
    ).rejects.toThrow(/al menos un campo/i);
  });

  it('crea con slug y lo lista', async () => {
    const ctx = await owner();
    const form = await companyForm(ctx);
    expect(form.slug).toMatch(/contacto-web-/);
    expect(form.fields).toHaveLength(2);
    expect(await listForms(ctx)).toHaveLength(1);
  });
});

describe('formularios · envío público', () => {
  it('un envío crea un registro con origen FORM', async () => {
    const ctx = await owner();
    const form = await companyForm(ctx);
    const res = await submitPublicForm(form.slug, { name: 'Acme', industry: 'Tecnología' });
    expect(res.action).toBe('created');

    const { records } = await listRecords(ctx, { objectSlug: 'companies', limit: 10 });
    expect(records).toHaveLength(1);
    const full = await getRecord(ctx, { objectSlug: 'companies', recordId: records[0].id });
    expect(full.data.name).toBe('Acme');
    expect(full.data.industry).toBe('Tecnología');
    expect(full.createdBy.source).toBe('FORM');
  });

  it('reenviar con el mismo campo clave actualiza en vez de duplicar', async () => {
    const ctx = await owner();
    const form = await companyForm(ctx);
    await submitPublicForm(form.slug, { name: 'Acme', industry: 'Viejo' });
    const res = await submitPublicForm(form.slug, { name: 'Acme', industry: 'Nuevo' });
    expect(res.action).toBe('updated');
    expect(await countCompanies(ctx)).toBe(1);

    const { records } = await listRecords(ctx, { objectSlug: 'companies', limit: 10 });
    const full = await getRecord(ctx, { objectSlug: 'companies', recordId: records[0].id });
    expect(full.data.industry).toBe('Nuevo');
  });

  it('el honeypot descarta el envío sin crear nada', async () => {
    const ctx = await owner();
    const form = await companyForm(ctx);
    const res = await submitPublicForm(form.slug, { name: 'Bot' }, { honeypot: 'soy-un-bot' });
    expect(res.action).toBeNull();
    expect(await countCompanies(ctx)).toBe(0);
  });

  it('exige los campos obligatorios', async () => {
    const ctx = await owner();
    const form = await companyForm(ctx);
    await expect(submitPublicForm(form.slug, { industry: 'sin nombre' })).rejects.toThrow(
      /obligatorio/i,
    );
  });

  it('un formulario inactivo no se sirve ni acepta envíos', async () => {
    const ctx = await owner();
    const form = await companyForm(ctx);
    await toggleForm(ctx, form.id); // → inactivo
    await expect(getPublicForm(form.slug)).rejects.toThrow(/no encontrado/i);
    await expect(submitPublicForm(form.slug, { name: 'x' })).rejects.toThrow(/no encontrado/i);
  });

  it('getPublicForm devuelve el esquema de render con el tipo de cada campo', async () => {
    const ctx = await owner();
    const form = await companyForm(ctx);
    const schema = await getPublicForm(form.slug);
    expect(schema.name).toBe('Contacto web');
    expect(schema.fields.map((f) => f.fieldName)).toEqual(['name', 'industry']);
    expect(schema.fields[0].required).toBe(true);
    expect(schema.fields[0].type).toBeTruthy();
  });
});
