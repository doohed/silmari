import { describe, it, expect, beforeEach } from 'vitest';
import mongoose from 'mongoose';
import { createAccount } from '@/lib/accounts/signup';
import { _resetSubscribers } from '@/lib/events/bus';
import { listNotifications } from '@/lib/notifications/service';
import { getObjectBySlug } from '@/lib/metadata/object-service';
import { createRecord, getRecord } from '@/lib/records/service';
import { listForRecord } from '@/lib/activities/service';
import {
  createAutomation,
  listAutomations,
  toggleAutomation,
  deleteAutomation,
} from '@/lib/automations/service';
import { runAutomationsForEvent } from '@/lib/automations/engine';
import { recordEvent } from '@/lib/events/types';

let seq = 0;

// Neutraliza el bus en este archivo: así `createRecord` no dispara el suscriptor
// de automatizaciones en segundo plano (fire-and-forget) y probamos el motor
// (`runAutomationsForEvent`) de forma directa y determinista.
beforeEach(() => {
  _resetSubscribers();
});

async function owner() {
  seq += 1;
  const { userId, workspaceId } = await createAccount({
    firstName: 'Auto',
    lastName: 'Mator',
    email: `auto${seq}@test.dev`,
    password: 'secret123',
    workspaceName: `Auto Co ${seq}`,
  });
  return { userId, workspaceId, role: 'OWNER' };
}

async function member(ctx) {
  return { ...ctx, role: 'MEMBER' };
}

/** Crea una empresa (name e industry son TEXT) y devuelve lo necesario para el motor. */
async function seedCompany(ctx, data) {
  const object = await getObjectBySlug(ctx, 'companies');
  const record = await createRecord(ctx, { objectSlug: 'companies', data });
  const event = recordEvent('created', object, record);
  return { object, record, event };
}

describe('automatizaciones · CRUD y permisos', () => {
  it('un MEMBER no puede gestionarlas', async () => {
    const ctx = await owner();
    const mem = await member(ctx);
    await expect(listAutomations(mem)).rejects.toThrow();
    await expect(
      createAutomation(mem, {
        name: 'x',
        trigger: { event: 'record.created', objectSlug: 'people' },
        actions: [{ type: 'notify', config: {} }],
      }),
    ).rejects.toThrow();
  });

  it('valida disparador, condiciones y acciones contra la metadata', async () => {
    const ctx = await owner();
    await expect(
      createAutomation(ctx, {
        name: 'sin acciones',
        trigger: { event: 'record.created', objectSlug: 'people' },
        actions: [],
      }),
    ).rejects.toThrow(/acción/i);
    await expect(
      createAutomation(ctx, {
        name: 'campo inexistente',
        trigger: { event: 'record.created', objectSlug: 'people' },
        conditions: [{ fieldName: 'noExiste', operator: 'is', value: 'x' }],
        actions: [{ type: 'notify', config: {} }],
      }),
    ).rejects.toThrow(/desconocido/i);
  });
});

describe('automatizaciones · motor', () => {
  it('ejecuta la acción crear tarea cuando se cumple la condición', async () => {
    const ctx = await owner();
    await createAutomation(ctx, {
      name: 'Tarea al crear VIP',
      trigger: { event: 'record.created', objectSlug: 'companies' },
      conditions: [{ fieldName: 'name', operator: 'eq', value: 'Acme VIP' }],
      actions: [{ type: 'create_task', config: { title: 'Llamar al VIP' } }],
    });

    const { record, event } = await seedCompany(ctx, { name: 'Acme VIP' });
    await runAutomationsForEvent(ctx, event);

    const tasks = await listForRecord(ctx, { recordId: record.id, type: 'TASK' });
    expect(tasks).toHaveLength(1);
    expect(tasks[0].title).toBe('Llamar al VIP');
  });

  it('no ejecuta si la condición no se cumple', async () => {
    const ctx = await owner();
    await createAutomation(ctx, {
      name: 'Tarea al crear VIP',
      trigger: { event: 'record.created', objectSlug: 'companies' },
      conditions: [{ fieldName: 'name', operator: 'eq', value: 'Acme VIP' }],
      actions: [{ type: 'create_task', config: { title: 'Llamar al VIP' } }],
    });

    const { record, event } = await seedCompany(ctx, { name: 'Otra cualquiera' });
    await runAutomationsForEvent(ctx, event);

    const tasks = await listForRecord(ctx, { recordId: record.id, type: 'TASK' });
    expect(tasks).toHaveLength(0);
  });

  it('la acción actualizar campo modifica el propio registro', async () => {
    const ctx = await owner();
    await createAutomation(ctx, {
      name: 'Marca el sector',
      trigger: { event: 'record.created', objectSlug: 'companies' },
      actions: [{ type: 'update_field', config: { fieldName: 'industry', value: 'Tecnología' } }],
    });

    const { record, event } = await seedCompany(ctx, { name: 'Sin sector' });
    await runAutomationsForEvent(ctx, event);

    const fresh = await getRecord(ctx, { objectSlug: 'companies', recordId: record.id });
    expect(fresh.data.industry).toBe('Tecnología');
  });

  it('una regla desactivada no se ejecuta', async () => {
    const ctx = await owner();
    const auto = await createAutomation(ctx, {
      name: 'Tarea siempre',
      trigger: { event: 'record.created', objectSlug: 'companies' },
      actions: [{ type: 'create_task', config: { title: 'x' } }],
    });
    await toggleAutomation(ctx, auto.id); // → inactiva

    const { record, event } = await seedCompany(ctx, { name: 'Alguien SA' });
    await runAutomationsForEvent(ctx, event);

    const tasks = await listForRecord(ctx, { recordId: record.id, type: 'TASK' });
    expect(tasks).toHaveLength(0);
    await deleteAutomation(ctx, auto.id);
  });

  it('la acción avisar crea una notificación para los destinatarios', async () => {
    const ctx = await owner();
    const recipient = new mongoose.Types.ObjectId().toString();
    await createAutomation(ctx, {
      name: 'Avisa al crear',
      trigger: { event: 'record.created', objectSlug: 'companies' },
      actions: [
        {
          type: 'notify',
          config: { userIds: [recipient], title: 'Nueva empresa', body: 'Revísala' },
        },
      ],
    });

    const { event } = await seedCompany(ctx, { name: 'Aviso SA' });
    await runAutomationsForEvent(ctx, event);

    const inbox = await listNotifications(
      { workspaceId: ctx.workspaceId, userId: recipient, role: 'MEMBER' },
      {},
    );
    expect(inbox).toHaveLength(1);
    expect(inbox[0].title).toBe('Nueva empresa');
  });

  it('avisa también al destinatario que provocó el disparo', async () => {
    // El caso de un workspace de una persona: el mismo usuario crea el registro
    // y es el destinatario de la regla. `notifyUsers` descarta al actor por
    // defecto; la acción `notify` lo desactiva a propósito (ver el motor).
    const ctx = await owner();
    await createAutomation(ctx, {
      name: 'Avísame a mí',
      trigger: { event: 'record.created', objectSlug: 'companies' },
      actions: [{ type: 'notify', config: { userIds: [ctx.userId], title: 'La creaste tú' } }],
    });

    const { record, event } = await seedCompany(ctx, { name: 'Yo Mismo SA' });
    await runAutomationsForEvent(ctx, event);

    const inbox = await listNotifications(ctx, {});
    expect(inbox).toHaveLength(1);
    expect(inbox[0].title).toBe('La creaste tú');
    // Y el enlace lleva al registro, no a la lista del objeto.
    expect(inbox[0].url).toBe(`/objects/companies/${record.id}`);
  });

  it('corta la cadena al alcanzar la profundidad máxima', async () => {
    const ctx = await owner();
    await createAutomation(ctx, {
      name: 'Bucle',
      trigger: { event: 'record.updated', objectSlug: 'companies' },
      actions: [{ type: 'create_task', config: { title: 'no debería' } }],
    });
    const { record, object } = await seedCompany(ctx, { name: 'Loop SA' });
    const deepEvent = { ...recordEvent('updated', object, record), meta: { automationDepth: 5 } };
    await runAutomationsForEvent(ctx, deepEvent);

    const tasks = await listForRecord(ctx, { recordId: record.id, type: 'TASK' });
    expect(tasks).toHaveLength(0);
  });
});
