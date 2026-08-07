import { describe, it, expect } from 'vitest';
import { createAccount } from '@/lib/accounts/signup';
import { createRecord } from '@/lib/records/service';
import { searchAll } from '@/lib/search/service';
import {
  addFavorite,
  listFavorites,
  isFavorite,
  removeFavoriteByTarget,
  reorderFavorites,
} from '@/lib/favorites/service';

async function owner(suffix = '') {
  const { userId, workspaceId } = await createAccount({
    firstName: 'Owner',
    lastName: 'Sea',
    email: `sea${suffix}@test.dev`,
    password: 'secret123',
    workspaceName: `Sea Co ${suffix}`,
  });
  return { userId, workspaceId, role: 'OWNER' };
}

describe('búsqueda global', () => {
  it('agrupa resultados por objeto y acota al workspace', async () => {
    const ctx = await owner('A');
    const acme = await createRecord(ctx, { objectSlug: 'companies', data: { name: 'Acme' } });
    await createRecord(ctx, {
      objectSlug: 'people',
      data: { name: { firstName: 'Ada', lastName: 'Byron' } },
    });

    const byName = await searchAll(ctx, { q: 'Acme' });
    const companies = byName.find((g) => g.object.slug === 'companies');
    expect(companies.records.map((r) => r.id)).toContain(acme.id);

    const byPerson = await searchAll(ctx, { q: 'Ada' });
    expect(byPerson.find((g) => g.object.slug === 'people').records[0].label).toBe('Ada Byron');

    // Otro workspace no ve nada de este.
    const other = await owner('B');
    expect(await searchAll(other, { q: 'Acme' })).toEqual([]);
  });
});

describe('favoritos', () => {
  it('añadir/listar/estado/reordenar/quitar', async () => {
    const ctx = await owner('C');
    const a = await createRecord(ctx, { objectSlug: 'companies', data: { name: 'Alpha' } });
    const b = await createRecord(ctx, { objectSlug: 'companies', data: { name: 'Beta' } });

    await addFavorite(ctx, { recordId: a.id });
    await addFavorite(ctx, { recordId: b.id });

    let favs = await listFavorites(ctx);
    expect(favs).toHaveLength(2);
    expect(favs[0].label).toBe('Alpha');
    expect(favs[0].href).toBe(`/objects/companies/${a.id}`);
    expect(await isFavorite(ctx, { recordId: a.id })).toBe(true);

    // Reordenar: Beta primero.
    await reorderFavorites(ctx, [favs[1].id, favs[0].id]);
    favs = await listFavorites(ctx);
    expect(favs[0].label).toBe('Beta');

    await removeFavoriteByTarget(ctx, { recordId: a.id });
    expect(await isFavorite(ctx, { recordId: a.id })).toBe(false);
    expect(await listFavorites(ctx)).toHaveLength(1);
  });
});
