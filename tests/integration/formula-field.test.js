import { describe, it, expect } from 'vitest';
import { createAccount } from '@/lib/accounts/signup';
import { getObjectBySlug } from '@/lib/metadata/object-service';
import { createField } from '@/lib/metadata/field-service';
import { createRecord, getRecord, listRecords } from '@/lib/records/service';

let seq = 0;

async function owner() {
  seq += 1;
  const { userId, workspaceId } = await createAccount({
    firstName: 'Calc',
    lastName: 'User',
    email: `calc${seq}@test.dev`,
    password: 'secret123',
    workspaceName: `Calc Co ${seq}`,
  });
  return { userId, workspaceId, role: 'OWNER' };
}

async function addFormula(ctx, formula, name = 'calc') {
  const companies = await getObjectBySlug(ctx, 'companies');
  return createField(ctx, {
    objectMetadataId: companies.id,
    name,
    label: 'Calculado',
    type: 'FORMULA',
    settings: { formula },
  });
}

describe('campos FORMULA · validación', () => {
  it('exige una fórmula', async () => {
    const ctx = await owner();
    await expect(addFormula(ctx, '')).rejects.toThrow(/fórmula/i);
  });

  it('rechaza fórmulas con sintaxis inválida', async () => {
    const ctx = await owner();
    await expect(addFormula(ctx, 'employees *')).rejects.toThrow();
  });

  it('rechaza referencias a campos inexistentes', async () => {
    const ctx = await owner();
    await expect(addFormula(ctx, 'noExiste + 1')).rejects.toThrow(/existe/i);
  });

  it('rechaza referencias a campos no numéricos', async () => {
    const ctx = await owner();
    // `name` es FULL_NAME (no numérico) en companies... en realidad TEXT: sigue sin ser numérico.
    await expect(addFormula(ctx, 'name + 1')).rejects.toThrow(/numérico/i);
  });
});

describe('campos FORMULA · cálculo', () => {
  it('calcula el valor al leer un registro (detalle)', async () => {
    const ctx = await owner();
    await addFormula(ctx, 'employees * 2', 'doubleEmployees');
    const rec = await createRecord(ctx, {
      objectSlug: 'companies',
      data: { name: 'Acme', employees: 10 },
    });
    const full = await getRecord(ctx, { objectSlug: 'companies', recordId: rec.id });
    expect(full.data.doubleEmployees).toBe(20);
  });

  it('calcula también en el listado, incluso con proyección de columnas', async () => {
    const ctx = await owner();
    await addFormula(ctx, 'employees + 5', 'plusFive');
    await createRecord(ctx, { objectSlug: 'companies', data: { name: 'A', employees: 3 } });

    const all = await listRecords(ctx, { objectSlug: 'companies' });
    expect(all.records[0].data.plusFive).toBe(8);

    // Proyección: solo pido name + la fórmula; sus dependencias se incluyen solas.
    const projected = await listRecords(ctx, {
      objectSlug: 'companies',
      fieldNames: ['name', 'plusFive'],
    });
    expect(projected.records[0].data.plusFive).toBe(8);
  });

  it('valores ausentes cuentan como 0; división por cero → null', async () => {
    const ctx = await owner();
    await addFormula(ctx, 'employees / 0', 'divZero');
    const rec = await createRecord(ctx, { objectSlug: 'companies', data: { name: 'Z' } });
    const full = await getRecord(ctx, { objectSlug: 'companies', recordId: rec.id });
    expect(full.data.divZero).toBeNull();
  });
});
