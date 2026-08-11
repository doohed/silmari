import { describe, it, expect } from 'vitest';
import { createAccount } from '@/lib/accounts/signup';
import { getObjectBySlug } from '@/lib/metadata/object-service';
import { listRecords, getRecord } from '@/lib/records/service';
import {
  createLeadIntake,
  listLeadIntakes,
  updateLeadIntake,
  deleteLeadIntake,
  ingestLead,
} from '@/lib/leads/service';

let seq = 0;

async function owner() {
  seq += 1;
  const { userId, workspaceId } = await createAccount({
    firstName: 'Owner',
    lastName: 'Lead',
    email: `lead${seq}@test.dev`,
    password: 'secret123',
    workspaceName: `Lead Co ${seq}`,
  });
  return { userId, workspaceId, role: 'OWNER' };
}

/** Configuración estándar: formulario de Meta → Contactos. */
async function intakeForPeople(ctx, overrides = {}) {
  const people = await getObjectBySlug(ctx, 'people');
  return createLeadIntake(ctx, {
    name: 'Campaña verano',
    formId: '123456',
    objectMetadataId: people.id,
    dedupeFieldName: 'emails',
    mappings: [
      { source: 'full_name', fieldName: 'name' },
      { source: 'email', fieldName: 'emails' },
      { source: 'phone_number', fieldName: 'phones' },
      { source: '¿Qué puesto ocupas?', fieldName: 'jobTitle' },
    ],
    ...overrides,
  });
}

/** Lead tal cual lo entrega la Graph API de Meta. */
function metaLead(overrides = {}) {
  return {
    created_time: '2026-08-10T09:00:00+0000',
    id: '99887766',
    form_id: '123456',
    page_id: '42',
    field_data: [
      { name: 'full_name', values: ['Ana Ruiz'] },
      { name: 'email', values: ['Ana@Ejemplo.com'] },
      { name: 'phone_number', values: ['+34600111222'] },
      { name: '¿Qué puesto ocupas?', values: ['Directora'] },
    ],
    ...overrides,
  };
}

describe('entrada de leads (Meta vía Zapier)', () => {
  it('crea un registro traduciendo los tipos compuestos del CRM', async () => {
    const ctx = await owner();
    await intakeForPeople(ctx);

    const result = await ingestLead(ctx, metaLead());
    expect(result.action).toBe('created');

    const record = await getRecord(ctx, { objectSlug: 'people', recordId: result.recordId });
    expect(record.data.name).toEqual({ firstName: 'Ana', lastName: 'Ruiz' });
    expect(record.data.emails).toEqual(['ana@ejemplo.com']);
    expect(record.data.phones).toEqual(['+34600111222']);
    expect(record.data.jobTitle).toBe('Directora');
    expect(record.createdBy.source).toBe('API');
  });

  it('actualiza en vez de duplicar cuando el campo clave ya existe', async () => {
    const ctx = await owner();
    await intakeForPeople(ctx);

    const first = await ingestLead(ctx, metaLead());
    const second = await ingestLead(
      ctx,
      metaLead({
        field_data: [
          { name: 'email', values: ['ana@ejemplo.com'] },
          { name: '¿Qué puesto ocupas?', values: ['CEO'] },
        ],
      }),
    );

    expect(second.action).toBe('updated');
    expect(second.recordId).toBe(first.recordId);

    const { records } = await listRecords(ctx, { objectSlug: 'people' });
    expect(records).toHaveLength(1);
    expect(records[0].data.jobTitle).toBe('CEO');
  });

  it('no confunde un email que contiene a otro como duplicado', async () => {
    const ctx = await owner();
    await intakeForPeople(ctx);

    await ingestLead(
      ctx,
      metaLead({ field_data: [{ name: 'email', values: ['ana@ejemplo.com'] }] }),
    );
    const other = await ingestLead(
      ctx,
      metaLead({ field_data: [{ name: 'email', values: ['juana@ejemplo.com'] }] }),
    );

    expect(other.action).toBe('created');
    const { records } = await listRecords(ctx, { objectSlug: 'people' });
    expect(records).toHaveLength(2);
  });

  it('sin campo clave crea siempre un registro nuevo', async () => {
    const ctx = await owner();
    await intakeForPeople(ctx, { dedupeFieldName: null });

    await ingestLead(ctx, metaLead());
    const again = await ingestLead(ctx, metaLead());

    expect(again.action).toBe('created');
    const { records } = await listRecords(ctx, { objectSlug: 'people' });
    expect(records).toHaveLength(2);
  });

  it('usa la configuración comodín cuando el formulario no tiene la suya', async () => {
    const ctx = await owner();
    await intakeForPeople(ctx, { formId: '' });

    const result = await ingestLead(ctx, metaLead({ form_id: '999-desconocido' }));
    expect(result.action).toBe('created');
  });

  it('rechaza el lead si no hay configuración activa', async () => {
    const ctx = await owner();
    const intake = await intakeForPeople(ctx);
    await updateLeadIntake(ctx, intake.id, { isActive: false });

    await expect(ingestLead(ctx, metaLead())).rejects.toThrow(/configuración de entrada/i);
  });

  it('acepta el payload aplanado de Zapier y registra el resultado', async () => {
    const ctx = await owner();
    const intake = await intakeForPeople(ctx);

    await ingestLead(ctx, {
      form_id: '123456',
      id: '5',
      full_name: 'Luis Paz',
      email: 'luis@ejemplo.com',
      campaign_name: 'Verano',
    });

    const [saved] = await listLeadIntakes(ctx);
    expect(saved.id).toBe(intake.id);
    expect(saved.stats.created).toBe(1);
    expect(saved.log[0].ok).toBe(true);
    expect(saved.log[0].action).toBe('created');
  });

  it('falla y lo anota si ninguna pregunta coincide con el mapeo', async () => {
    const ctx = await owner();
    await intakeForPeople(ctx);

    await expect(ingestLead(ctx, { form_id: '123456', pregunta_rara: 'valor' })).rejects.toThrow(
      /ninguna de las preguntas mapeadas/i,
    );

    const [saved] = await listLeadIntakes(ctx);
    expect(saved.stats.failed).toBe(1);
  });

  it('valida el mapeo y el campo clave contra la metadata real', async () => {
    const ctx = await owner();
    const people = await getObjectBySlug(ctx, 'people');

    await expect(
      createLeadIntake(ctx, {
        name: 'Mala',
        objectMetadataId: people.id,
        mappings: [{ source: 'email', fieldName: 'campoQueNoExiste' }],
      }),
    ).rejects.toThrow(/no existe/i);

    // `name` es FULL_NAME: compuesto, no sirve para comparar de forma exacta.
    await expect(
      createLeadIntake(ctx, {
        name: 'Mala clave',
        objectMetadataId: people.id,
        dedupeFieldName: 'name',
        mappings: [{ source: 'email', fieldName: 'emails' }],
      }),
    ).rejects.toThrow(/clave de duplicados/i);
  });

  it('impide dos configuraciones para el mismo formulario', async () => {
    const ctx = await owner();
    await intakeForPeople(ctx);
    await expect(intakeForPeople(ctx)).rejects.toThrow(/Ya hay una configuración/i);
  });

  it('borra una configuración', async () => {
    const ctx = await owner();
    const intake = await intakeForPeople(ctx);
    await deleteLeadIntake(ctx, intake.id);
    expect(await listLeadIntakes(ctx)).toHaveLength(0);
  });
});
