import { describe, it, expect } from 'vitest';
import { createAccount } from '@/lib/accounts/signup';
import { createRecord } from '@/lib/records/service';
import { generateKeyBetween } from 'fractional-indexing';
import {
  listDashboards,
  getDashboard,
  createDashboard,
  renameDashboard,
  deleteDashboard,
  reorderDashboard,
  updateDashboardWidgets,
  getOpportunityMetrics,
} from '@/lib/dashboards/service';

async function ownerCtx(email = 'dash@test.dev') {
  const { userId, workspaceId } = await createAccount({
    firstName: 'Dash',
    lastName: 'Owner',
    email,
    password: 'secret123',
    workspaceName: 'Dash Co',
  });
  return { userId, workspaceId, role: 'OWNER' };
}

describe('paneles (dashboards)', () => {
  it('crea el panel por defecto la primera vez y luego lo reutiliza', async () => {
    const ctx = await ownerCtx('dash-create@test.dev');
    const a = await listDashboards(ctx);
    expect(a).toHaveLength(1);
    expect(a[0].widgets.length).toBeGreaterThan(0);
    const b = await listDashboards(ctx);
    expect(b).toHaveLength(1);
    expect(b[0].id).toBe(a[0].id);
  });

  it('resuelve el creador y las fechas en la lista', async () => {
    const ctx = await ownerCtx('dash-meta@test.dev');
    const [only] = await listDashboards(ctx);
    // El panel por defecto lo crea el propio owner del alta.
    expect(only.createdBy.name).toBe('Dash Owner');
    expect(only.createdAt).toBeTruthy();
    expect(only.updatedAt).toBeTruthy();
  });

  it('crea, obtiene por id, renombra y borra paneles adicionales', async () => {
    const ctx = await ownerCtx('dash-crud@test.dev');
    await listDashboards(ctx); // asegura el panel por defecto
    const created = await createDashboard(ctx, { name: 'Ventas' });
    expect(created.name).toBe('Ventas');
    expect((await listDashboards(ctx)).map((d) => d.name)).toContain('Ventas');

    const fetched = await getDashboard(ctx, { id: created.id });
    expect(fetched.id).toBe(created.id);
    expect(fetched.widgets.length).toBeGreaterThan(0);

    const renamed = await renameDashboard(ctx, { id: created.id, name: '  Cierres  ' });
    expect(renamed.name).toBe('Cierres');

    await deleteDashboard(ctx, { id: created.id });
    const remaining = await listDashboards(ctx);
    expect(remaining.map((d) => d.id)).not.toContain(created.id);
    await expect(getDashboard(ctx, { id: created.id })).rejects.toThrow();
  });

  it('asigna posición al crear y reordena arrastrando', async () => {
    const ctx = await ownerCtx('dash-order@test.dev');
    const [first] = await listDashboards(ctx); // panel por defecto (con posición)
    const b = await createDashboard(ctx, { name: 'B' });
    const c = await createDashboard(ctx, { name: 'C' });

    // Orden inicial por posición: por defecto · B · C.
    let list = await listDashboards(ctx);
    expect(list.map((d) => d.name)).toEqual([first.name, 'B', 'C']);
    expect(list.every((d) => typeof d.position === 'string' && d.position.length > 0)).toBe(true);

    // Mover C al principio: posición antes de la primera.
    const beforeFirst = generateKeyBetween(null, list[0].position);
    await reorderDashboard(ctx, { id: c.id, position: beforeFirst });

    list = await listDashboards(ctx);
    expect(list.map((d) => d.name)).toEqual(['C', first.name, 'B']);
  });

  it('rechaza una posición inválida al reordenar', async () => {
    const ctx = await ownerCtx('dash-order-bad@test.dev');
    const [only] = await listDashboards(ctx);
    await expect(reorderDashboard(ctx, { id: only.id, position: '' })).rejects.toThrow();
  });

  it('no permite nombre vacío ni borrar el último panel', async () => {
    const ctx = await ownerCtx('dash-guard@test.dev');
    const [only] = await listDashboards(ctx);
    await expect(createDashboard(ctx, { name: '   ' })).rejects.toThrow();
    await expect(deleteDashboard(ctx, { id: only.id })).rejects.toThrow();
  });

  it('guarda widgets válidos en el panel indicado y descarta tipos desconocidos', async () => {
    const ctx = await ownerCtx('dash-save@test.dev');
    const [dash] = await listDashboards(ctx);
    const saved = await updateDashboardWidgets(ctx, {
      id: dash.id,
      widgets: [{ type: 'by-company' }, { type: 'inventado' }, { type: 'timeline' }],
    });
    expect(saved.widgets.map((w) => w.type)).toEqual(['by-company', 'timeline']);
    expect(saved.widgets.every((w) => w.id)).toBe(true);
  });

  it('calcula métricas de oportunidades', async () => {
    const ctx = await ownerCtx('dash-metrics@test.dev');
    await createRecord(ctx, {
      objectSlug: 'opportunities',
      data: { name: 'A', amount: { amount: 1000, currencyCode: 'EUR' }, stage: 'won' },
    });
    await createRecord(ctx, {
      objectSlug: 'opportunities',
      data: { name: 'B', amount: { amount: 500, currencyCode: 'EUR' }, stage: 'new' },
    });

    const m = await getOpportunityMetrics(ctx);
    expect(m.totalCount).toBe(2);
    expect(m.totalPipeline).toBe(1500);
    expect(m.wonCount).toBe(1);
    // Ambas creadas ahora → cuentan como de este mes.
    expect(m.createdThisMonthCount).toBe(2);
    // El responsable por defecto es el creador.
    expect(m.byOwner.find((o) => o.label === 'Dash Owner')?.value).toBe(2);
  });
});
