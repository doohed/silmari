import { describe, it, expect } from 'vitest';
import mongoose from 'mongoose';
import { buildQuery } from '@/lib/records/query-builder';
import { encodeCursor } from '@/lib/utils/cursor';

const fields = [
  { name: 'precio', type: 'NUMBER' },
  { name: 'nombre', type: 'TEXT' },
];
const workspaceId = new mongoose.Types.ObjectId();
const objectMetadataId = new mongoose.Types.ObjectId();

describe('buildQuery', () => {
  it('base excluye borrados y filtra por tenant/objeto', () => {
    const { match, sort } = buildQuery({ workspaceId, objectMetadataId, fields });
    expect(match.$and).toContainEqual({ workspaceId, objectMetadataId });
    expect(match.$and).toContainEqual({ deletedAt: null });
    expect(sort).toEqual({ position: 1, _id: 1 }); // por defecto, orden manual por `position`
  });

  it('traduce filtros con el registry de tipos', () => {
    const { match } = buildQuery({
      workspaceId,
      objectMetadataId,
      fields,
      filters: [{ fieldName: 'precio', operator: 'gte', value: '10' }],
    });
    expect(match.$and).toContainEqual({ 'data.precio': { $gte: 10 } });
  });

  it('rechaza operadores no válidos para el tipo', () => {
    expect(() =>
      buildQuery({
        workspaceId,
        objectMetadataId,
        fields,
        filters: [{ fieldName: 'precio', operator: 'contains', value: 'x' }],
      }),
    ).toThrow();
  });

  it('sin orden de columna pagina por `position` (orden manual)', () => {
    const id = new mongoose.Types.ObjectId();
    const cursor = encodeCursor({ sortValue: 'a1', id: String(id) });
    const { sort, match } = buildQuery({ workspaceId, objectMetadataId, fields, cursor });
    expect(sort).toEqual({ position: 1, _id: 1 });
    const cursorClause = match.$and.find((c) => c.$or);
    expect(cursorClause.$or[0]).toEqual({ position: { $gt: 'a1' } });
  });

  it('rechaza un valor de filtro con forma de objeto (operador de Mongo)', () => {
    // Sin esto, `{$regex}` llegaría al match y el cliente escribiría la consulta.
    for (const value of [
      { $ne: null },
      { $regex: '(a+)+$', $options: 'i' },
      { $gt: '' },
      ['a', 'b'],
    ]) {
      expect(() =>
        buildQuery({
          workspaceId,
          objectMetadataId,
          fields,
          filters: [{ fieldName: 'nombre', operator: 'eq', value }],
        }),
      ).toThrow(/filtro no válido/i);
    }
  });

  it('los operadores de conjunto aceptan lista y envuelven el valor suelto', () => {
    const select = [
      { name: 'etapa', type: 'SELECT', options: [{ value: 'nueva', label: 'Nueva' }] },
    ];
    const listado = buildQuery({
      workspaceId,
      objectMetadataId,
      fields: select,
      filters: [{ fieldName: 'etapa', operator: 'isAnyOf', value: ['nueva', 'ganada'] }],
    });
    expect(listado.match.$and).toContainEqual({ 'data.etapa': { $in: ['nueva', 'ganada'] } });

    const suelto = buildQuery({
      workspaceId,
      objectMetadataId,
      fields: select,
      filters: [{ fieldName: 'etapa', operator: 'isAnyOf', value: 'nueva' }],
    });
    expect(suelto.match.$and).toContainEqual({ 'data.etapa': { $in: ['nueva'] } });
  });

  it('ignora un cursor cuyo sortValue no es escalar', () => {
    const id = new mongoose.Types.ObjectId();
    const cursor = encodeCursor({ sortValue: { $ne: null }, id: String(id) });
    const { match } = buildQuery({ workspaceId, objectMetadataId, fields, cursor });
    expect(match.$and.find((c) => c.$or)).toBeUndefined();
  });

  it('un cursor con un id que no es ObjectId es entrada inválida, no un 500', () => {
    const cursor = encodeCursor({ sortValue: 'a1', id: 'no-soy-un-objectid' });
    expect(() => buildQuery({ workspaceId, objectMetadataId, fields, cursor })).toThrow(
      /cursor de paginación/i,
    );
  });

  it('ordena por campo primario + _id y aplica el cursor', () => {
    const id = new mongoose.Types.ObjectId();
    const cursor = encodeCursor({ sortValue: 100, id: String(id) });
    const { sort, match } = buildQuery({
      workspaceId,
      objectMetadataId,
      fields,
      sorts: [{ fieldName: 'precio', direction: 'asc' }],
      cursor,
    });
    expect(sort).toEqual({ 'data.precio': 1, _id: 1 });
    const cursorClause = match.$and.find((c) => c.$or);
    expect(cursorClause.$or[0]).toEqual({ 'data.precio': { $gt: 100 } });
  });
});
