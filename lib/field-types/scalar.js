import {
  z,
  OPERATORS,
  dataPath,
  escapeRegex,
  emptinessFilter,
  nullable,
  defaultCompare,
} from './helpers';

/** Filtro para tipos textuales. */
function textFilter(fieldName, op, value) {
  const path = dataPath(fieldName);
  switch (op) {
    case 'eq':
      return { [path]: value };
    case 'neq':
      return { [path]: { $ne: value } };
    case 'contains':
      return { [path]: new RegExp(escapeRegex(value), 'i') };
    case 'notContains':
      return { [path]: { $not: new RegExp(escapeRegex(value), 'i') } };
    case 'startsWith':
      return { [path]: new RegExp(`^${escapeRegex(value)}`, 'i') };
    case 'endsWith':
      return { [path]: new RegExp(`${escapeRegex(value)}$`, 'i') };
    case 'isEmpty':
    case 'isNotEmpty':
      return emptinessFilter(path, op);
    default:
      throw new Error(`Operador no soportado: ${op}`);
  }
}

/** Filtro para tipos numéricos. */
function numberFilter(fieldName, op, value) {
  const path = dataPath(fieldName);
  const n = Number(value);
  switch (op) {
    case 'eq':
      return { [path]: n };
    case 'neq':
      return { [path]: { $ne: n } };
    case 'gt':
      return { [path]: { $gt: n } };
    case 'gte':
      return { [path]: { $gte: n } };
    case 'lt':
      return { [path]: { $lt: n } };
    case 'lte':
      return { [path]: { $lte: n } };
    case 'isEmpty':
    case 'isNotEmpty':
      return emptinessFilter(path, op);
    default:
      throw new Error(`Operador no soportado: ${op}`);
  }
}

/** Filtro para fechas. */
function dateFilter(fieldName, op, value) {
  const path = dataPath(fieldName);
  const d = value != null ? new Date(value) : null;
  switch (op) {
    case 'eq':
      return { [path]: d };
    case 'neq':
      return { [path]: { $ne: d } };
    case 'before':
      return { [path]: { $lt: d } };
    case 'after':
      return { [path]: { $gt: d } };
    case 'isEmpty':
    case 'isNotEmpty':
      return emptinessFilter(path, op);
    default:
      throw new Error(`Operador no soportado: ${op}`);
  }
}

const text = {
  type: 'TEXT',
  schema: (m) => nullable(z.string(), m),
  defaultValue: (m) => m?.defaultValue ?? '',
  normalize: (v) => (v == null ? null : String(v)),
  filterOperators: OPERATORS.text,
  buildFilter: textFilter,
  compare: defaultCompare,
  toSearchText: (v) => (v == null ? '' : String(v)),
};

const richText = {
  type: 'RICH_TEXT',
  // Puede ser HTML (string) o JSON de Tiptap (objeto).
  schema: (m) => nullable(z.union([z.string(), z.record(z.string(), z.any())]), m),
  defaultValue: (m) => m?.defaultValue ?? '',
  normalize: (v) => v ?? null,
  filterOperators: ['isEmpty', 'isNotEmpty'],
  buildFilter: (fieldName, op) => emptinessFilter(dataPath(fieldName), op),
  compare: () => 0,
  toSearchText: (v) => (typeof v === 'string' ? v.replace(/<[^>]*>/g, ' ') : ''),
};

const uuid = {
  type: 'UUID',
  schema: (m) => nullable(z.uuid(), m),
  defaultValue: (m) => m?.defaultValue ?? null,
  normalize: (v) => (v == null ? null : String(v)),
  filterOperators: OPERATORS.minimal,
  buildFilter: textFilter,
  compare: defaultCompare,
  toSearchText: (v) => (v == null ? '' : String(v)),
};

const number = {
  type: 'NUMBER',
  schema: (m) => nullable(z.number(), m),
  defaultValue: (m) => m?.defaultValue ?? null,
  normalize: (v) => (v == null || v === '' ? null : Number(v)),
  filterOperators: OPERATORS.number,
  buildFilter: numberFilter,
  compare: defaultCompare,
  toSearchText: (v) => (v == null ? '' : String(v)),
};

const currency = {
  type: 'CURRENCY',
  // Se ordena por el importe, no por el subdocumento `{amount, currencyCode}`:
  // el cursor de paginación solo sabe viajar con un escalar.
  sortPath: (base) => `${base}.amount`,
  schema: (m) =>
    nullable(z.object({ amount: z.number(), currencyCode: z.string().default('EUR') }), m),
  defaultValue: (m) => m?.defaultValue ?? null,
  normalize: (v) =>
    v == null ? null : { amount: Number(v.amount), currencyCode: v.currencyCode ?? 'EUR' },
  filterOperators: OPERATORS.number,
  buildFilter: (fieldName, op, value) => numberFilter(`${fieldName}.amount`, op, value),
  compare: (a, b) => defaultCompare(a?.amount, b?.amount),
  toSearchText: (v) => (v == null ? '' : String(v.amount)),
};

const percent = {
  type: 'PERCENT',
  schema: (m) => nullable(z.number(), m),
  defaultValue: (m) => m?.defaultValue ?? null,
  normalize: (v) => (v == null || v === '' ? null : Number(v)),
  filterOperators: OPERATORS.number,
  buildFilter: numberFilter,
  compare: defaultCompare,
  toSearchText: (v) => (v == null ? '' : `${v}%`),
};

const rating = {
  type: 'RATING',
  schema: (m) => nullable(z.number().int().min(0).max(5), m),
  defaultValue: (m) => m?.defaultValue ?? null,
  normalize: (v) => (v == null || v === '' ? null : Math.round(Number(v))),
  filterOperators: OPERATORS.number,
  buildFilter: numberFilter,
  compare: defaultCompare,
  toSearchText: () => '',
};

const boolean = {
  type: 'BOOLEAN',
  schema: (m) => nullable(z.boolean(), m),
  defaultValue: (m) => m?.defaultValue ?? false,
  normalize: (v) => Boolean(v),
  filterOperators: OPERATORS.boolean,
  buildFilter: (fieldName, op, value) => ({ [dataPath(fieldName)]: Boolean(value) }),
  compare: (a, b) => Number(a) - Number(b),
  toSearchText: () => '',
};

const date = {
  type: 'DATE',
  schema: (m) => nullable(z.coerce.date(), m),
  defaultValue: (m) => m?.defaultValue ?? null,
  normalize: (v) => (v == null || v === '' ? null : new Date(v)),
  filterOperators: OPERATORS.date,
  buildFilter: dateFilter,
  compare: (a, b) => defaultCompare(a && +new Date(a), b && +new Date(b)),
  toSearchText: (v) => (v == null ? '' : new Date(v).toISOString().slice(0, 10)),
};

const dateTime = {
  ...date,
  type: 'DATE_TIME',
  toSearchText: (v) => (v == null ? '' : new Date(v).toISOString()),
};

export const scalarTypes = [
  text,
  richText,
  uuid,
  number,
  currency,
  percent,
  rating,
  boolean,
  date,
  dateTime,
];
