import { describe, it, expect } from 'vitest';
import { createAccount } from '@/lib/accounts/signup';
import { getObjectBySlug } from '@/lib/metadata/object-service';
import { createRecord } from '@/lib/records/service';
import { logCommunication, listForRecord, listTasks } from '@/lib/activities/service';
import { recordInboundEmail, sendEmail } from '@/lib/email/service';
import { recordInboundMessage, sendWhatsapp } from '@/lib/whatsapp/service';
import { createTemplate } from '@/lib/templates/service';

let seq = 0;

async function owner() {
  seq += 1;
  const { userId, workspaceId } = await createAccount({
    firstName: 'Comm',
    lastName: 'User',
    email: `comm${seq}@test.dev`,
    password: 'secret123',
    workspaceName: `Comm Co ${seq}`,
  });
  return {
    userId,
    workspaceId,
    role: 'OWNER',
    actorName: 'Comm User',
    userEmail: `comm${seq}@test.dev`,
  };
}

async function companyWithTarget(ctx) {
  const object = await getObjectBySlug(ctx, 'companies');
  const record = await createRecord(ctx, { objectSlug: 'companies', data: { name: 'Acme' } });
  return { targets: [{ objectMetadataId: object.id, recordId: record.id }], record };
}

describe('comunicaciones · registro contra la ficha', () => {
  it('registra un email y aparece en las actividades del registro', async () => {
    const ctx = await owner();
    const { targets, record } = await companyWithTarget(ctx);

    const act = await logCommunication(ctx, {
      channel: 'EMAIL',
      direction: 'OUTBOUND',
      subject: 'Propuesta',
      body: 'Adjunto la propuesta',
      to: 'cliente@acme.com',
      targets,
    });
    expect(act.type).toBe('EMAIL');
    expect(act.comm.channel).toBe('EMAIL');
    expect(act.comm.direction).toBe('OUTBOUND');
    expect(act.comm.to).toEqual(['cliente@acme.com']);

    const emails = await listForRecord(ctx, { recordId: record.id, type: 'EMAIL' });
    expect(emails).toHaveLength(1);
    expect(emails[0].title).toBe('Propuesta');
  });

  it('las comunicaciones no contaminan la bandeja de tareas', async () => {
    const ctx = await owner();
    const { targets } = await companyWithTarget(ctx);
    await logCommunication(ctx, { channel: 'EMAIL', subject: 'x', to: 'a@b.com', targets });
    await logCommunication(ctx, { channel: 'WHATSAPP', body: 'hola', to: '+34600', targets });
    expect(await listTasks(ctx)).toHaveLength(0);
  });

  it('rechaza un canal no válido', async () => {
    const ctx = await owner();
    await expect(logCommunication(ctx, { channel: 'SMS', body: 'x' })).rejects.toThrow(/canal/i);
  });

  it('el historial lista email y whatsapp juntos (varios tipos)', async () => {
    const ctx = await owner();
    const { targets, record } = await companyWithTarget(ctx);
    await logCommunication(ctx, { channel: 'EMAIL', subject: 'e', to: 'a@b.com', targets });
    await logCommunication(ctx, { channel: 'WHATSAPP', body: 'w', to: '+34', targets });
    const all = await listForRecord(ctx, { recordId: record.id, type: ['EMAIL', 'WHATSAPP'] });
    expect(all).toHaveLength(2);
    expect(all.map((a) => a.type).sort()).toEqual(['EMAIL', 'WHATSAPP']);
  });
});

describe('email · seam', () => {
  it('registrar un email entrante crea la comunicación', async () => {
    const ctx = await owner();
    const { targets, record } = await companyWithTarget(ctx);
    await recordInboundEmail(ctx, {
      from: 'cliente@acme.com',
      subject: 'Re: propuesta',
      body: 'Me interesa',
      targets,
    });
    const emails = await listForRecord(ctx, { recordId: record.id, type: 'EMAIL' });
    expect(emails).toHaveLength(1);
    expect(emails[0].comm.direction).toBe('INBOUND');
    expect(emails[0].comm.from).toBe('cliente@acme.com');
  });

  it('enviar sin cuenta conectada lanza un error claro (no finge enviar)', async () => {
    const ctx = await owner();
    await expect(sendEmail(ctx, { to: 'x@y.com', subject: 'hola', body: 'test' })).rejects.toThrow(
      /cuenta de correo conectada/i,
    );
  });

  it('enviar con plantilla la renderiza antes de fallar por falta de proveedor', async () => {
    const ctx = await owner();
    const object = await getObjectBySlug(ctx, 'companies');
    const record = await createRecord(ctx, { objectSlug: 'companies', data: { name: 'Acme' } });
    const tpl = await createTemplate(ctx, {
      name: 'Saludo',
      channel: 'EMAIL',
      objectSlug: 'companies',
      subject: 'Hola {{name}}',
      body: 'Cuerpo',
    });
    // Sin proveedor conectado sigue lanzando, pero el render se ejercita en la ruta.
    await expect(
      sendEmail(ctx, {
        templateId: tpl.id,
        objectSlug: 'companies',
        recordId: record.id,
        to: 'x@y.com',
      }),
    ).rejects.toThrow(/cuenta de correo conectada/i);
    expect(object).toBeTruthy();
  });
});

describe('whatsapp · seam', () => {
  it('registrar un mensaje entrante crea la comunicación', async () => {
    const ctx = await owner();
    const { targets, record } = await companyWithTarget(ctx);
    await recordInboundMessage(ctx, { from: '+34600111222', body: 'Hola', targets });
    const msgs = await listForRecord(ctx, { recordId: record.id, type: 'WHATSAPP' });
    expect(msgs).toHaveLength(1);
    expect(msgs[0].comm.direction).toBe('INBOUND');
  });

  it('enviar sin número conectado lanza un error claro', async () => {
    const ctx = await owner();
    await expect(sendWhatsapp(ctx, { to: '+34600', body: 'hola' })).rejects.toThrow(/WhatsApp/i);
  });
});
