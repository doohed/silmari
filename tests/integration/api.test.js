import { describe, it, expect } from 'vitest';
import { createAccount } from '@/lib/accounts/signup';
import { createApiKey } from '@/lib/auth/api-key';
import { GET as listGET, POST as listPOST } from '@/app/api/v1/[objectSlug]/route';
import {
  GET as oneGET,
  PATCH as onePATCH,
  DELETE as oneDELETE,
} from '@/app/api/v1/[objectSlug]/[recordId]/route';
import { GET as objectsGET } from '@/app/api/v1/metadata/objects/route';

const BASE = 'http://localhost/api/v1';

function req(url, { method = 'GET', token, body } = {}) {
  const headers = { 'content-type': 'application/json' };
  if (token) headers.authorization = `Bearer ${token}`;
  return new Request(url, { method, headers, body: body ? JSON.stringify(body) : undefined });
}

const params = (obj) => ({ params: Promise.resolve(obj) });

async function setup() {
  const { userId, workspaceId } = await createAccount({
    firstName: 'Api',
    lastName: 'User',
    email: 'api@test.dev',
    password: 'secret123',
    workspaceName: 'Api Co',
  });
  const ctx = { userId, workspaceId, role: 'OWNER' };
  const { token } = await createApiKey(ctx, { name: 'test' });
  return { ctx, token };
}

describe('API REST v1 (route handlers)', () => {
  it('exige autenticación', async () => {
    const res = await listGET(req(`${BASE}/companies`), params({ objectSlug: 'companies' }));
    expect(res.status).toBe(401);
  });

  it('CRUD completo por objeto', async () => {
    const { token } = await setup();

    // POST create
    const createRes = await listPOST(
      req(`${BASE}/companies`, {
        method: 'POST',
        token,
        body: { data: { name: 'ApiCo', employees: 7 } },
      }),
      params({ objectSlug: 'companies' }),
    );
    expect(createRes.status).toBe(201);
    const created = (await createRes.json()).data;
    expect(created.data.name).toBe('ApiCo');

    // GET list + filtro
    const listRes = await listGET(
      req(`${BASE}/companies?filter=employees:gte:5`, { token }),
      params({ objectSlug: 'companies' }),
    );
    expect(listRes.status).toBe(200);
    const list = await listRes.json();
    expect(list.data.length).toBe(1);

    // GET one
    const getRes = await oneGET(
      req(`${BASE}/companies/${created.id}`, { token }),
      params({ objectSlug: 'companies', recordId: created.id }),
    );
    expect((await getRes.json()).data.data.employees).toBe(7);

    // PATCH
    const patchRes = await onePATCH(
      req(`${BASE}/companies/${created.id}`, {
        method: 'PATCH',
        token,
        body: { data: { employees: 42 } },
      }),
      params({ objectSlug: 'companies', recordId: created.id }),
    );
    expect((await patchRes.json()).data.data.employees).toBe(42);

    // DELETE (soft)
    const delRes = await oneDELETE(
      req(`${BASE}/companies/${created.id}`, { method: 'DELETE', token }),
      params({ objectSlug: 'companies', recordId: created.id }),
    );
    expect(delRes.status).toBe(204);

    const afterDel = await listGET(
      req(`${BASE}/companies`, { token }),
      params({ objectSlug: 'companies' }),
    );
    expect((await afterDel.json()).data.length).toBe(0);
  });

  it('metadata/objects lista los objetos', async () => {
    const { token } = await setup();
    const res = await objectsGET(req(`${BASE}/metadata/objects`, { token }));
    const body = await res.json();
    expect(res.status).toBe(200);
    expect(body.data.map((o) => o.slug)).toContain('companies');
  });

  it('respeta los scopes de la key', async () => {
    const { ctx } = await setup();
    const { token } = await createApiKey(ctx, { name: 'ro', scopes: ['records:read'] });
    const res = await listPOST(
      req(`${BASE}/companies`, { method: 'POST', token, body: { data: { name: 'X' } } }),
      params({ objectSlug: 'companies' }),
    );
    expect(res.status).toBe(403);
  });
});
