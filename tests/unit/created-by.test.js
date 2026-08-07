import { describe, it, expect } from 'vitest';
import mongoose from 'mongoose';
import { fieldPath, isRootField, readFieldValue } from '@/lib/records/field-path';
import { isWritableField } from '@/lib/field-types';
import { validateAndNormalize } from '@/lib/records/validate';
import { buildSearchText } from '@/lib/records/search-text';
import { buildQuery, buildNextCursor } from '@/lib/records/query-builder';
import { ValidationError } from '@/lib/errors/domain-errors';

const createdBy = { name: 'createdBy', label: 'Creado por', type: 'ACTOR', isSystem: true };
const nombre = { name: 'nombre', label: 'Nombre', type: 'TEXT' };
const fields = [nombre, createdBy];

describe('campo de sistema "Creado por"', () => {
  it('se resuelve contra la raíz del documento, no contra data', () => {
    expect(isRootField(createdBy)).toBe(true);
    expect(fieldPath(createdBy)).toBe('createdBy');
    expect(fieldPath(nombre)).toBe('data.nombre');
  });

  it('un campo ACTOR que no sea de sistema sigue viviendo en data', () => {
    expect(fieldPath({ name: 'createdBy', type: 'ACTOR' })).toBe('data.createdBy');
  });

  it('lee el valor de la raíz del registro', () => {
    const record = { data: { nombre: 'Acme' }, createdBy: { source: 'API', name: 'Ada' } };
    expect(readFieldValue(record, createdBy)).toEqual({ source: 'API', name: 'Ada' });
    expect(readFieldValue(record, nombre)).toBe('Acme');
  });

  it('no es escribible desde el cliente', () => {
    expect(isWritableField(createdBy)).toBe(false);
    expect(isWritableField(nombre)).toBe(true);
  });

  it('no entra en data ni con valor por defecto al crear', () => {
    const out = validateAndNormalize(fields, { nombre: 'Acme' });
    expect(out).toEqual({ nombre: 'Acme' });
    expect(out).not.toHaveProperty('createdBy');
  });

  it('rechaza que el cliente lo envíe', () => {
    let error;
    try {
      validateAndNormalize(fields, { nombre: 'Acme', createdBy: { source: 'SYSTEM' } });
    } catch (err) {
      error = err;
    }
    expect(error).toBeInstanceOf(ValidationError);
    expect(error.fieldErrors.createdBy).toEqual(['"Creado por" es de solo lectura']);
  });

  it('no contamina el searchText', () => {
    expect(buildSearchText(fields, { nombre: 'Acme', createdBy: { name: 'Ada' } })).toBe('Acme');
  });
});

describe('consultas sobre "Creado por"', () => {
  const workspaceId = new mongoose.Types.ObjectId();
  const objectMetadataId = new mongoose.Types.ObjectId();

  it('filtra por el origen en la raíz', () => {
    const { match } = buildQuery({
      workspaceId,
      objectMetadataId,
      fields,
      filters: [{ fieldName: 'createdBy', operator: 'eq', value: 'API' }],
    });
    expect(match.$and).toContainEqual({ 'createdBy.source': 'API' });
  });

  it('ordena por el origen en la raíz', () => {
    const { sort } = buildQuery({
      workspaceId,
      objectMetadataId,
      fields,
      sorts: [{ fieldName: 'createdBy', direction: 'desc' }],
    });
    expect(sort).toEqual({ 'createdBy.source': -1, _id: -1 });
  });

  it('el cursor toma el valor de la ruta por la que ordena', () => {
    const last = { _id: new mongoose.Types.ObjectId(), createdBy: { source: 'API' } };
    const cursor = buildNextCursor(last, createdBy);
    const decoded = JSON.parse(Buffer.from(cursor, 'base64').toString());
    expect(decoded.sortValue).toBe('API');
  });
});
