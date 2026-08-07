import { describe, it, expect } from 'vitest';
import mongoose from 'mongoose';
import { createAccount } from '@/lib/accounts/signup';
import { listObjects, getObjectBySlug, createObject } from '@/lib/metadata/object-service';
import { createField, updateField } from '@/lib/metadata/field-service';
import Record from '@/models/Record';

async function owner() {
  const { userId, workspaceId } = await createAccount({
    firstName: 'Owner',
    lastName: 'Meta',
    email: 'meta@test.dev',
    password: 'secret123',
    workspaceName: 'Meta Co',
  });
  return { userId, workspaceId, role: 'OWNER' };
}

describe('seed de objetos estándar', () => {
  it('el signup siembra los objetos estándar con su identificador', async () => {
    const ctx = await owner();
    const objects = await listObjects(ctx);
    const slugs = objects.map((o) => o.slug).sort();
    // Notas/Tareas/Archivos son colecciones dedicadas, no objetos.
    expect(slugs).toEqual(['companies', 'opportunities', 'people'].sort());

    const company = await getObjectBySlug(ctx, 'companies');
    expect(company.isCustom).toBe(false);
    const nameField = company.fields.find((f) => f.name === 'name');
    expect(nameField).toBeTruthy();
    expect(company.labelIdentifierFieldId).toBe(nameField.id);
  });

  it('las relaciones estándar resuelven su objeto destino', async () => {
    const ctx = await owner();
    const [company, person] = await Promise.all([
      getObjectBySlug(ctx, 'companies'),
      getObjectBySlug(ctx, 'people'),
    ]);
    const rel = person.fields.find((f) => f.name === 'company');
    expect(rel.type).toBe('RELATION');
    expect(String(rel.relation.targetObjectMetadataId)).toBe(company.id);
  });

  it('la opción de etapa de Opportunity tiene colores', async () => {
    const ctx = await owner();
    const opp = await getObjectBySlug(ctx, 'opportunities');
    const stage = opp.fields.find((f) => f.name === 'stage');
    expect(stage.options.map((o) => o.value)).toContain('won');
    expect(stage.options.find((o) => o.value === 'won').color).toBe('green');
  });

  it('personalizar las etapas: renombra, recolorea y añade sin desligar registros', async () => {
    const ctx = await owner();
    const opp = await getObjectBySlug(ctx, 'opportunities');
    const stage = opp.fields.find((f) => f.name === 'stage');

    const won = stage.options.find((o) => o.value === 'won');
    const other = stage.options.filter((o) => o.value !== 'won');

    // Edición como la del ajuste: preserva id/value de las existentes, añade una nueva.
    const updated = await updateField(ctx, stage.id, {
      options: [
        ...other.map((o, i) => ({ id: o.id, value: o.value, label: o.label, color: o.color, position: i })),
        { id: won.id, value: won.value, label: 'Cerrada ganada', color: 'blue', position: other.length },
        { label: 'En pausa', color: 'yellow', position: other.length + 1 },
      ],
    });

    const wonAfter = updated.options.find((o) => o.value === 'won');
    expect(wonAfter.label).toBe('Cerrada ganada'); // renombrada
    expect(wonAfter.color).toBe('blue'); // recoloreada
    expect(wonAfter.value).toBe('won'); // el value se conserva
    const nueva = updated.options.find((o) => o.label === 'En pausa');
    expect(nueva.value).toBe('en-pausa'); // value autogenerado por slug
  });
});

describe('CRUD de metadata + criterio de la fase', () => {
  it('crea "Producto" con 8 campos de tipos distintos y aparece en la navegación', async () => {
    const ctx = await owner();
    const company = await getObjectBySlug(ctx, 'companies');

    const producto = await createObject(ctx, {
      nameSingular: 'producto',
      labelSingular: 'Producto',
      labelPlural: 'Productos',
    });
    // createObject añade el campo identificador `name` (TEXT) automáticamente.
    expect(producto.slug).toBe('productos');

    const defs = [
      { name: 'precio', label: 'Precio', type: 'NUMBER' },
      { name: 'coste', label: 'Coste', type: 'CURRENCY' },
      { name: 'activo', label: 'Activo', type: 'BOOLEAN' },
      { name: 'lanzamiento', label: 'Lanzamiento', type: 'DATE' },
      {
        name: 'categoria',
        label: 'Categoría',
        type: 'SELECT',
        options: [{ label: 'A' }, { label: 'B' }],
      },
      {
        name: 'etiquetas',
        label: 'Etiquetas',
        type: 'MULTI_SELECT',
        options: [{ label: 'Nuevo' }, { label: 'Oferta' }],
      },
      { name: 'contactos', label: 'Contactos', type: 'EMAILS' },
      {
        name: 'fabricante',
        label: 'Fabricante',
        type: 'RELATION',
        relation: { type: 'MANY_TO_ONE', targetObjectMetadataId: company.id },
      },
    ];
    for (const d of defs) {
      await createField(ctx, { objectMetadataId: producto.id, ...d });
    }

    const hydrated = await getObjectBySlug(ctx, 'productos');
    expect(hydrated.fields).toHaveLength(9); // name + 8
    const types = hydrated.fields.map((f) => f.type);
    expect(new Set(types).size).toBeGreaterThanOrEqual(8);

    // Aparece en la navegación (listObjects) sin tocar código.
    const nav = await listObjects(ctx);
    expect(nav.map((o) => o.slug)).toContain('productos');
  });

  it('rechaza nombres reservados, no-camelCase, duplicados y SELECT sin opciones', async () => {
    const ctx = await owner();
    const p = await createObject(ctx, { nameSingular: 'cosa', labelSingular: 'Cosa' });

    await expect(
      createField(ctx, { objectMetadataId: p.id, name: 'data', label: 'X', type: 'TEXT' }),
    ).rejects.toThrow(/reservado/i);
    await expect(
      createField(ctx, { objectMetadataId: p.id, name: 'Mal Nombre', label: 'X', type: 'TEXT' }),
    ).rejects.toThrow();
    await expect(
      createField(ctx, { objectMetadataId: p.id, name: 'name', label: 'Dup', type: 'TEXT' }),
    ).rejects.toThrow(/existe/i);
    await expect(
      createField(ctx, { objectMetadataId: p.id, name: 'sel', label: 'Sel', type: 'SELECT' }),
    ).rejects.toThrow(/opción/i);
  });

  it('bloquea el cambio de tipo si hay datos incompatibles', async () => {
    const ctx = await owner();
    const p = await createObject(ctx, { nameSingular: 'item', labelSingular: 'Item' });
    const field = await createField(ctx, {
      objectMetadataId: p.id,
      name: 'edad',
      label: 'Edad',
      type: 'NUMBER',
    });

    // Sin datos: el cambio es libre.
    await updateField(ctx, field.id, { type: 'TEXT' });

    // Con un dato numérico, cambiar a BOOLEAN debe bloquearse.
    await updateField(ctx, field.id, { type: 'NUMBER' });
    await Record.create({
      workspaceId: ctx.workspaceId,
      objectMetadataId: p.id,
      data: { edad: 5 },
    });
    await expect(updateField(ctx, field.id, { type: 'BOOLEAN' })).rejects.toThrow(/compatible/i);
  });

  it('crea un índice único para campos isUnique', async () => {
    const ctx = await owner();
    const p = await createObject(ctx, { nameSingular: 'sku', labelSingular: 'Sku' });
    await createField(ctx, {
      objectMetadataId: p.id,
      name: 'codigo',
      label: 'Código',
      type: 'TEXT',
      isUnique: true,
    });
    const indexes = await mongoose.connection.collection('records').indexes();
    // Índice compartido por nombre de campo (no por objeto).
    const found = indexes.find((i) => i.name === 'fld_codigo_uq');
    expect(found).toBeTruthy();
    expect(found.unique).toBe(true);
  });
});
