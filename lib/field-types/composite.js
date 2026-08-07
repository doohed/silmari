import { z, dataPath, escapeRegex, emptinessFilter, nullable } from './helpers';

/** Filtro de "array de strings" (EMAILS, PHONES): contiene / vacío. */
function arrayStringFilter(fieldName, op, value) {
  const path = dataPath(fieldName);
  switch (op) {
    case 'contains':
      return { [path]: new RegExp(escapeRegex(value), 'i') };
    case 'isEmpty':
      return { $or: [{ [path]: { $exists: false } }, { [path]: null }, { [path]: { $size: 0 } }] };
    case 'isNotEmpty':
      return { [path]: { $exists: true, $not: { $size: 0 } } };
    default:
      throw new Error(`Operador no soportado: ${op}`);
  }
}

const fullName = {
  type: 'FULL_NAME',
  schema: (m) =>
    nullable(z.object({ firstName: z.string().default(''), lastName: z.string().default('') }), m),
  defaultValue: (m) => m?.defaultValue ?? { firstName: '', lastName: '' },
  normalize: (v) =>
    v == null ? null : { firstName: String(v.firstName ?? ''), lastName: String(v.lastName ?? '') },
  filterOperators: ['contains', 'isEmpty', 'isNotEmpty'],
  buildFilter: (fieldName, op, value) => {
    if (op === 'contains') {
      const rx = new RegExp(escapeRegex(value), 'i');
      return {
        $or: [
          { [dataPath(`${fieldName}.firstName`)]: rx },
          { [dataPath(`${fieldName}.lastName`)]: rx },
        ],
      };
    }
    return emptinessFilter(dataPath(`${fieldName}.lastName`), op);
  },
  compare: (a, b) => {
    const an = `${a?.lastName ?? ''} ${a?.firstName ?? ''}`.trim();
    const bn = `${b?.lastName ?? ''} ${b?.firstName ?? ''}`.trim();
    return an.localeCompare(bn);
  },
  toSearchText: (v) => (v == null ? '' : `${v.firstName ?? ''} ${v.lastName ?? ''}`.trim()),
};

const address = {
  type: 'ADDRESS',
  schema: (m) =>
    nullable(
      z.object({
        street: z.string().default(''),
        city: z.string().default(''),
        state: z.string().default(''),
        postalCode: z.string().default(''),
        country: z.string().default(''),
      }),
      m,
    ),
  defaultValue: (m) => m?.defaultValue ?? null,
  normalize: (v) => v ?? null,
  filterOperators: ['contains', 'isEmpty', 'isNotEmpty'],
  buildFilter: (fieldName, op, value) => {
    if (op === 'contains') {
      const rx = new RegExp(escapeRegex(value), 'i');
      return {
        $or: ['street', 'city', 'state', 'postalCode', 'country'].map((k) => ({
          [dataPath(`${fieldName}.${k}`)]: rx,
        })),
      };
    }
    return emptinessFilter(dataPath(`${fieldName}.city`), op);
  },
  compare: () => 0,
  toSearchText: (v) =>
    v == null ? '' : [v.street, v.city, v.state, v.postalCode, v.country].filter(Boolean).join(' '),
};

const emails = {
  type: 'EMAILS',
  schema: (m) => nullable(z.array(z.email()), m),
  defaultValue: (m) => m?.defaultValue ?? [],
  normalize: (v) => (Array.isArray(v) ? v.map((s) => String(s).trim().toLowerCase()) : []),
  filterOperators: ['contains', 'isEmpty', 'isNotEmpty'],
  buildFilter: arrayStringFilter,
  compare: (a, b) => (a?.[0] ?? '').localeCompare(b?.[0] ?? ''),
  toSearchText: (v) => (Array.isArray(v) ? v.join(' ') : ''),
};

const phones = {
  type: 'PHONES',
  schema: (m) => nullable(z.array(z.string()), m),
  defaultValue: (m) => m?.defaultValue ?? [],
  normalize: (v) => (Array.isArray(v) ? v.map((s) => String(s).trim()) : []),
  filterOperators: ['contains', 'isEmpty', 'isNotEmpty'],
  buildFilter: arrayStringFilter,
  compare: () => 0,
  toSearchText: (v) => (Array.isArray(v) ? v.join(' ') : ''),
};

const links = {
  type: 'LINKS',
  schema: (m) =>
    nullable(z.array(z.object({ url: z.url(), label: z.string().optional().default('') })), m),
  defaultValue: (m) => m?.defaultValue ?? [],
  normalize: (v) =>
    Array.isArray(v) ? v.map((l) => ({ url: String(l.url), label: l.label ?? '' })) : [],
  filterOperators: ['isEmpty', 'isNotEmpty'],
  buildFilter: (fieldName, op) => arrayStringFilter(fieldName, op),
  compare: () => 0,
  toSearchText: (v) =>
    Array.isArray(v)
      ? v
          .map((l) => `${l.label ?? ''} ${l.url ?? ''}`)
          .join(' ')
          .trim()
      : '',
};

export const compositeTypes = [fullName, address, emails, phones, links];
