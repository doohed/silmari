import { describe, it, expect } from 'vitest';
import { createAccount } from '@/lib/accounts/signup';
import { createRecord } from '@/lib/records/service';
import { exportWorkspace } from '@/lib/accounts/export-workspace';

let seq = 0;
async function owner(role = 'OWNER') {
  seq += 1;
  const { userId, workspaceId } = await createAccount({
    firstName: 'Ana',
    lastName: 'Ruiz',
    email: `exp${seq}@test.dev`,
    password: 'secret123',
    workspaceName: `Export Co ${seq}`,
  });
  return { userId, workspaceId, role };
}

describe('exportación del espacio de trabajo (portabilidad RGPD)', () => {
  it('incluye la metadata junto a los datos, para que el volcado se entienda solo', async () => {
    const ctx = await owner();
    await createRecord(ctx, { objectSlug: 'companies', data: { name: 'Acme' } });

    const dump = await exportWorkspace(ctx);

    expect(dump.formatVersion).toBe(1);
    expect(dump.workspace.name).toContain('Export Co');

    // Sin la definición de campos, `data` sería un diccionario opaco.
    const companies = dump.objects.find((o) => o.slug === 'companies');
    expect(companies).toBeTruthy();
    expect(companies.fields.map((f) => f.name)).toContain('name');
    expect(companies.fields.find((f) => f.name === 'name')).toMatchObject({ type: 'TEXT' });
  });

  it('lleva los registros con el objeto al que pertenecen', async () => {
    const ctx = await owner();
    await createRecord(ctx, { objectSlug: 'companies', data: { name: 'Acme' } });
    await createRecord(ctx, { objectSlug: 'companies', data: { name: 'Globex' } });

    const dump = await exportWorkspace(ctx);
    const names = dump.records.map((r) => r.data.name);

    expect(dump.records).toHaveLength(2);
    expect(names).toContain('Acme');
    expect(names).toContain('Globex');
    expect(dump.records[0].object).toBe('companies');
  });

  it('lleva los miembros pero nunca contraseñas ni secretos', async () => {
    const ctx = await owner();
    const dump = await exportWorkspace(ctx);

    expect(dump.members).toHaveLength(1);
    expect(dump.members[0].email).toContain('@test.dev');
    expect(dump.members[0].role).toBe('OWNER');

    const serialized = JSON.stringify(dump);
    expect(serialized).not.toContain('passwordHash');
    expect(serialized).not.toContain('tokenHash');
    expect(serialized).not.toContain('$2b$'); // prefijo de bcrypt
  });

  it('solo exporta el workspace propio', async () => {
    const ctxA = await owner();
    const ctxB = await owner();
    await createRecord(ctxA, { objectSlug: 'companies', data: { name: 'Solo de A' } });

    const dumpB = await exportWorkspace(ctxB);
    expect(JSON.stringify(dumpB)).not.toContain('Solo de A');
    expect(dumpB.records).toHaveLength(0);
  });

  it('un miembro raso no puede exportar el espacio entero', async () => {
    const ctx = await owner('MEMBER');
    await expect(exportWorkspace(ctx)).rejects.toThrow(/No puedes exportar/i);
  });
});
