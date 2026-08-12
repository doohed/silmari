import { describe, it, expect } from 'vitest';
import { createAccount } from '@/lib/accounts/signup';
import { createObject, getObjectBySlug } from '@/lib/metadata/object-service';
import { createField } from '@/lib/metadata/field-service';
import { createRecord } from '@/lib/records/service';
import { searchProducts, listPriceFields } from '@/lib/quotes/service';

let seq = 0;

async function owner() {
  seq += 1;
  const { userId, workspaceId } = await createAccount({
    firstName: 'Prod',
    lastName: 'Cat',
    email: `prod${seq}@test.dev`,
    password: 'secret123',
    workspaceName: `Prod Co ${seq}`,
  });
  return { userId, workspaceId, role: 'OWNER' };
}

/** Crea un objeto-catálogo `productos` con un campo de precio CURRENCY. */
async function catalog(ctx) {
  const obj = await createObject(ctx, {
    nameSingular: 'producto',
    namePlural: 'productos',
    labelSingular: 'Producto',
    labelPlural: 'Productos',
  });
  await createField(ctx, {
    objectMetadataId: obj.id,
    name: 'price',
    label: 'Precio',
    type: 'CURRENCY',
  });
  return getObjectBySlug(ctx, 'productos');
}

const money = (n) => ({ amount: n, currencyCode: 'EUR' });

describe('catálogo de productos para LINE_ITEMS', () => {
  it('busca productos y devuelve etiqueta + precio', async () => {
    const ctx = await owner();
    await catalog(ctx);
    await createRecord(ctx, {
      objectSlug: 'productos',
      data: { name: 'Licencia Pro', price: money(199) },
    });
    await createRecord(ctx, {
      objectSlug: 'productos',
      data: { name: 'Soporte', price: money(50) },
    });

    const all = await searchProducts(ctx, { objectSlug: 'productos', priceFieldName: 'price' });
    expect(all).toHaveLength(2);
    expect(all.find((p) => p.label === 'Licencia Pro').price).toBe(199);

    const filtered = await searchProducts(ctx, {
      objectSlug: 'productos',
      priceFieldName: 'price',
      q: 'Licencia',
    });
    expect(filtered).toHaveLength(1);
    expect(filtered[0].label).toBe('Licencia Pro');
  });

  it('lista los campos de precio (CURRENCY/NUMBER) del catálogo', async () => {
    const ctx = await owner();
    const obj = await catalog(ctx);
    const fields = await listPriceFields(ctx, { objectMetadataId: obj.id });
    expect(fields.some((f) => f.name === 'price')).toBe(true);
  });

  it('valida la configuración de catálogo de un campo LINE_ITEMS', async () => {
    const ctx = await owner();
    await catalog(ctx);
    const opps = await getObjectBySlug(ctx, 'opportunities');

    // Catálogo inexistente → error.
    await expect(
      createField(ctx, {
        objectMetadataId: opps.id,
        name: 'linesBad',
        label: 'Líneas',
        type: 'LINE_ITEMS',
        settings: { lineItems: { productObjectSlug: 'noexiste' } },
      }),
    ).rejects.toThrow();

    // Catálogo + precio válidos → se crea.
    const ok = await createField(ctx, {
      objectMetadataId: opps.id,
      name: 'linesOk',
      label: 'Líneas',
      type: 'LINE_ITEMS',
      settings: { lineItems: { productObjectSlug: 'productos', priceFieldName: 'price' } },
    });
    expect(ok.type).toBe('LINE_ITEMS');
  });
});
