import { describe, it, expect } from 'vitest';
import http from 'node:http';
import { createAccount } from '@/lib/accounts/signup';
import { getCurrentWorkspace, updateWorkspace } from '@/lib/workspaces/service';
import { getObjectBySlug, createObject } from '@/lib/metadata/object-service';
import { createField } from '@/lib/metadata/field-service';
import { createApiKey, listApiKeys, revokeApiKey } from '@/lib/auth/api-key';
import {
  createWebhook,
  listWebhooks,
  dispatchWebhooks,
  retryDelivery,
} from '@/lib/webhooks/service';

async function owner(suffix = '') {
  const { userId, workspaceId } = await createAccount({
    firstName: 'Owner',
    lastName: 'Set',
    email: `set${suffix}@test.dev`,
    password: 'secret123',
    workspaceName: `Set Co ${suffix}`,
  });
  return { userId, workspaceId, role: 'OWNER' };
}

describe('ajustes', () => {
  it('actualiza el workspace', async () => {
    const ctx = await owner('W');
    await updateWorkspace(ctx, { name: 'Nuevo Nombre', settings: { currency: 'USD' } });
    const ws = await getCurrentWorkspace(ctx);
    expect(ws.name).toBe('Nuevo Nombre');
    expect(ws.settings.currency).toBe('USD');
  });

  it('crea un objeto custom con una relación hacia Company (editor de datos)', async () => {
    const ctx = await owner('D');
    const companies = await getObjectBySlug(ctx, 'companies');
    const producto = await createObject(ctx, {
      nameSingular: 'producto',
      labelSingular: 'Producto',
      labelPlural: 'Productos',
    });
    await createField(ctx, {
      objectMetadataId: producto.id,
      name: 'fabricante',
      label: 'Fabricante',
      type: 'RELATION',
      relation: { type: 'MANY_TO_ONE', targetObjectMetadataId: companies.id },
    });

    const hydrated = await getObjectBySlug(ctx, 'productos');
    const rel = hydrated.fields.find((f) => f.name === 'fabricante');
    expect(rel.type).toBe('RELATION');
    expect(rel.relation.targetObjectMetadataId).toBe(companies.id);
  });

  it('crea, lista y revoca API keys', async () => {
    const ctx = await owner('K');
    const { id } = await createApiKey(ctx, { name: 'test' });
    let keys = await listApiKeys(ctx);
    expect(keys.map((k) => k.id)).toContain(id);
    expect(keys[0].revokedAt).toBeNull();

    await revokeApiKey(ctx, id);
    keys = await listApiKeys(ctx);
    expect(keys.find((k) => k.id === id).revokedAt).toBeTruthy();
  });

  it('webhooks: despacho real, log de entregas y reintento', async () => {
    const ctx = await owner('H');
    const received = [];
    const server = http.createServer((req, res) => {
      let body = '';
      req.on('data', (c) => (body += c));
      req.on('end', () => {
        received.push({ signature: req.headers['x-silmari-signature'], body });
        res.writeHead(200);
        res.end('ok');
      });
    });
    await new Promise((r) => server.listen(0, '127.0.0.1', r));
    const { port } = server.address();

    try {
      const hook = await createWebhook(ctx, {
        targetUrl: `http://127.0.0.1:${port}/hook`,
        operations: ['company.created'],
      });

      await dispatchWebhooks(ctx, { operation: 'company.created', payload: { id: 'abc' } });
      expect(received).toHaveLength(1);
      expect(received[0].signature).toBeTruthy();

      let list = await listWebhooks(ctx);
      const wh = list.find((w) => w.id === hook.id);
      expect(wh.deliveryLog[0].ok).toBe(true);
      expect(wh.deliveryLog[0].statusCode).toBe(200);

      // Reintento re-entrega.
      await retryDelivery(ctx, { webhookId: hook.id, deliveryId: wh.deliveryLog[0].id });
      expect(received).toHaveLength(2);
    } finally {
      await new Promise((r) => server.close(r));
    }
  });
});
