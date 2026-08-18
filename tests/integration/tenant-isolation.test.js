import { describe, it, expect } from 'vitest';
import { createAccount } from '@/lib/accounts/signup';
import { authenticate } from '@/lib/accounts/authenticate';
import { listMembers, inviteMember } from '@/lib/members/service';
import { getCurrentWorkspace } from '@/lib/workspaces/service';
import { getMembershipRole } from '@/lib/workspaces/service';
import { getObjectBySlug } from '@/lib/metadata/object-service';
import { listRecords } from '@/lib/records/service';
import {
  createLeadIntake,
  listLeadIntakes,
  deleteLeadIntake,
  ingestLead,
} from '@/lib/leads/service';
import { createDashboard, listDashboards, getDashboard } from '@/lib/dashboards/service';
import { saveEmailConnection, getEmailConnection } from '@/lib/integrations/service';

/** Crea una cuenta y devuelve su ctx OWNER. */
async function makeAccount(suffix) {
  const { userId, workspaceId } = await createAccount({
    firstName: `User${suffix}`,
    lastName: 'Test',
    email: `user${suffix}@test.dev`,
    password: 'secret123',
    workspaceName: `Workspace ${suffix}`,
  });
  return { userId, workspaceId, role: 'OWNER' };
}

describe('multi-tenancy: aislamiento entre workspaces', () => {
  it('un usuario solo ve los miembros de SU workspace', async () => {
    const ctxA = await makeAccount('A');
    const ctxB = await makeAccount('B');

    const membersA = await listMembers(ctxA);
    const membersB = await listMembers(ctxB);

    expect(membersA).toHaveLength(1);
    expect(membersB).toHaveLength(1);
    expect(membersA[0].userId).toBe(ctxA.userId);
    expect(membersB[0].userId).toBe(ctxB.userId);

    // Ningún miembro de A aparece en B y viceversa.
    const idsA = membersA.map((m) => m.userId);
    const idsB = membersB.map((m) => m.userId);
    expect(idsA).not.toContain(ctxB.userId);
    expect(idsB).not.toContain(ctxA.userId);
  });

  it('el workspace devuelto es siempre el del ctx, nunca el de otro', async () => {
    const ctxA = await makeAccount('A');
    const ctxB = await makeAccount('B');

    const wsA = await getCurrentWorkspace(ctxA);
    expect(wsA.id).toBe(ctxA.workspaceId);
    expect(wsA.id).not.toBe(ctxB.workspaceId);
  });

  it('un usuario NO pertenece al workspace de otro', async () => {
    const ctxA = await makeAccount('A');
    const ctxB = await makeAccount('B');

    expect(await getMembershipRole(ctxA.userId, ctxA.workspaceId)).toBe('OWNER');
    expect(await getMembershipRole(ctxA.userId, ctxB.workspaceId)).toBeNull();
  });

  it('login resuelve solo el workspace propio del usuario', async () => {
    const ctxA = await makeAccount('A');
    await makeAccount('B');

    const session = await authenticate({ email: 'userA@test.dev', password: 'secret123' });
    expect(session.userId).toBe(ctxA.userId);
    expect(session.workspaceId).toBe(ctxA.workspaceId);
  });

  it('un servicio consultado SIN workspaceId falla en vez de filtrar datos', async () => {
    const ctxA = await makeAccount('A');
    const broken = { userId: ctxA.userId, role: 'OWNER' }; // sin workspaceId

    await expect(listMembers(broken)).rejects.toThrow(/tenant/i);
    await expect(getCurrentWorkspace(broken)).rejects.toThrow(/tenant/i);
    await expect(inviteMember(broken, { email: 'x@test.dev', role: 'MEMBER' })).rejects.toThrow(
      /tenant/i,
    );
  });
});

/**
 * Servicios añadidos después del núcleo original. Cada uno se comprueba en dos
 * ejes: no ver lo del vecino, y no poder tocarlo aun conociendo su id.
 *
 * Van agrupados en pocos tests a propósito: el harness limpia las colecciones
 * antes de cada `it`, así que cada test tiene que crear sus cuentas, y crear una
 * cuenta siembra los objetos estándar y sus índices. Un test por servicio
 * encarecía la suite sin añadir cobertura.
 */
describe('multi-tenancy: servicios posteriores', () => {
  it('la entrada de leads está aislada: ni se ve, ni se borra, ni recibe leads de otro', async () => {
    const ctxA = await makeAccount('SvcA');
    const ctxB = await makeAccount('SvcB');

    const people = await getObjectBySlug(ctxA, 'people');
    const intake = await createLeadIntake(ctxA, {
      name: 'Campaña A',
      formId: '111',
      objectMetadataId: people.id,
      mappings: [{ source: 'email', fieldName: 'emails' }],
    });

    expect(await listLeadIntakes(ctxA)).toHaveLength(1);
    expect(await listLeadIntakes(ctxB)).toHaveLength(0);

    // B conoce el id de A y aun así no puede borrarlo.
    await expect(deleteLeadIntake(ctxB, intake.id)).rejects.toThrow(/no encontrada/i);
    expect(await listLeadIntakes(ctxA)).toHaveLength(1);

    // B manda un lead con el MISMO form_id que A: el form_id jamás debe servir
    // para escribir en el workspace de otro.
    await expect(ingestLead(ctxB, { form_id: '111', email: 'intruso@test.dev' })).rejects.toThrow(
      /configuración de entrada/i,
    );
    const { records } = await listRecords(ctxA, { objectSlug: 'people' });
    expect(records).toHaveLength(0);
  });

  it('paneles y conexiones de integración están aislados', async () => {
    const ctxA = await makeAccount('SvcC');
    const ctxB = await makeAccount('SvcD');

    const dash = await createDashboard(ctxA, { name: 'Ventas A' });
    expect((await listDashboards(ctxB)).map((d) => d.id)).not.toContain(dash.id);
    await expect(getDashboard(ctxB, { id: dash.id })).rejects.toThrow();

    await saveEmailConnection(ctxA, {
      host: 'smtp.test.dev',
      port: 587,
      user: 'ana@test.dev',
      password: 'secreto-de-A',
      fromName: 'Ana',
    });

    const connA = await getEmailConnection(ctxA);
    const connB = await getEmailConnection(ctxB);

    expect(connA.connected).toBe(true);
    expect(connA.host).toBe('smtp.test.dev');

    // B no solo no está conectado: no ve ni un dato de la conexión de A.
    expect(connB.connected).toBe(false);
    expect(JSON.stringify(connB)).not.toContain('smtp.test.dev');
    expect(JSON.stringify(connB)).not.toContain('ana@test.dev');
  });
});
