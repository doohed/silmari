import { z, OPERATORS, dataPath, emptinessFilter, nullable, defaultCompare } from './helpers';
import { fieldPath } from '@/lib/records/field-path';

const array = {
  type: 'ARRAY',
  schema: (m) => nullable(z.array(z.string()), m),
  defaultValue: (m) => m?.defaultValue ?? [],
  normalize: (v) => (Array.isArray(v) ? v.map(String) : v == null ? [] : [String(v)]),
  filterOperators: ['contains', 'isEmpty', 'isNotEmpty'],
  buildFilter: (fieldName, op, value) => {
    const path = dataPath(fieldName);
    if (op === 'contains') return { [path]: value };
    if (op === 'isEmpty')
      return { $or: [{ [path]: { $exists: false } }, { [path]: null }, { [path]: { $size: 0 } }] };
    return { [path]: { $exists: true, $not: { $size: 0 } } };
  },
  compare: (a, b) => defaultCompare((a ?? []).length, (b ?? []).length),
  toSearchText: (v) => (Array.isArray(v) ? v.join(' ') : ''),
};

const rawJson = {
  type: 'RAW_JSON',
  schema: (m) => nullable(z.any(), m),
  defaultValue: (m) => m?.defaultValue ?? null,
  normalize: (v) => v ?? null,
  filterOperators: ['isEmpty', 'isNotEmpty'],
  buildFilter: (fieldName, op) => emptinessFilter(dataPath(fieldName), op),
  compare: () => 0,
  toSearchText: () => '',
};

const actor = {
  type: 'ACTOR',
  // Lo escribe el sistema (quién creó el registro y desde dónde). Nunca se
  // acepta del cliente: `validateAndNormalize` lo rechaza como solo lectura.
  schema: (m) =>
    nullable(
      z.object({
        userId: z.string().nullish(),
        name: z.string().default(''),
        source: z.enum(['MANUAL', 'API', 'IMPORT', 'SYSTEM']).default('SYSTEM'),
      }),
      m,
    ),
  defaultValue: () => null,
  normalize: (v) => v ?? null,
  isReadOnly: true,
  filterOperators: OPERATORS.minimal,
  // Se filtra y ordena por `source` (el origen), que es lo que muestra la celda.
  buildFilter: (fieldName, op, value, fieldMeta) => {
    const path = `${fieldMeta ? fieldPath(fieldMeta) : dataPath(fieldName)}.source`;
    if (op === 'eq') return { [path]: value };
    if (op === 'neq') return { [path]: { $ne: value } };
    return emptinessFilter(path, op);
  },
  sortPath: (base) => `${base}.source`,
  compare: (a, b) => (a?.source ?? '').localeCompare(b?.source ?? ''),
  toSearchText: (v) => v?.name ?? '',
};

const position = {
  type: 'POSITION',
  // Clave string de fractional indexing (ver decisión de la Fase 0).
  schema: (m) => nullable(z.string(), m),
  defaultValue: (m) => m?.defaultValue ?? null,
  normalize: (v) => (v == null ? null : String(v)),
  filterOperators: OPERATORS.minimal,
  buildFilter: (fieldName, op, value) => ({
    [dataPath(fieldName)]: op === 'neq' ? { $ne: value } : value,
  }),
  compare: defaultCompare,
  toSearchText: () => '',
};

const relation = {
  type: 'RELATION',
  // MANY_TO_ONE guarda el id del registro destino en `data`. ONE_TO_MANY y
  // MANY_TO_MANY se materializan en la colección recordRelations (no en `data`).
  schema: (m) => {
    if (m?.relation?.type === 'MANY_TO_ONE') return nullable(z.string(), m);
    return z.undefined().nullish();
  },
  defaultValue: () => null,
  normalize: (v, m) =>
    m?.relation?.type === 'MANY_TO_ONE' ? (v == null ? null : String(v)) : undefined,
  filterOperators: OPERATORS.minimal,
  buildFilter: (fieldName, op, value) => {
    const path = dataPath(fieldName);
    if (op === 'eq') return { [path]: value };
    if (op === 'neq') return { [path]: { $ne: value } };
    return emptinessFilter(path, op);
  },
  compare: defaultCompare,
  toSearchText: () => '',
  isRelation: true,
};

const member = {
  type: 'MEMBER',
  // Guarda el `userId` de un miembro del workspace. La etiqueta (nombre + avatar)
  // se hidrata aparte, igual que RELATION. Por defecto, al crear un registro se
  // rellena con el creador (ver createRecord); es editable.
  schema: (m) => nullable(z.string(), m),
  defaultValue: () => null,
  normalize: (v) => (v == null || v === '' ? null : String(v)),
  filterOperators: OPERATORS.minimal,
  buildFilter: (fieldName, op, value) => {
    const path = dataPath(fieldName);
    if (op === 'eq') return { [path]: value };
    if (op === 'neq') return { [path]: { $ne: value } };
    return emptinessFilter(path, op);
  },
  compare: defaultCompare,
  toSearchText: () => '',
  isMember: true,
};

export const specialTypes = [array, rawJson, actor, position, relation, member];
