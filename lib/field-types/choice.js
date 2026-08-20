import { z, OPERATORS, dataPath, emptinessFilter, nullable, defaultCompare } from './helpers';

/** Valores permitidos declarados en la metadata del campo (options[].value). */
function allowedValues(fieldMeta) {
  return (fieldMeta?.options ?? []).map((o) => o.value);
}

/** Mapa value → label para búsqueda/visualización. */
function labelOf(fieldMeta, value) {
  const opt = (fieldMeta?.options ?? []).find((o) => o.value === value);
  return opt?.label ?? String(value ?? '');
}

const select = {
  type: 'SELECT',
  schema: (m) => {
    const allowed = allowedValues(m);
    const base = allowed.length ? z.enum(allowed) : z.string();
    return nullable(base, m);
  },
  defaultValue: (m) => m?.defaultValue ?? null,
  normalize: (v) => (v == null || v === '' ? null : String(v)),
  filterOperators: OPERATORS.select,
  buildFilter: (fieldName, op, value) => {
    const path = dataPath(fieldName);
    switch (op) {
      case 'is':
        return { [path]: value };
      case 'isNot':
        return { [path]: { $ne: value } };
      case 'isAnyOf':
        return { [path]: { $in: value } };
      case 'isNoneOf':
        return { [path]: { $nin: value } };
      case 'isEmpty':
      case 'isNotEmpty':
        return emptinessFilter(path, op);
      default:
        throw new Error(`Operador no soportado: ${op}`);
    }
  },
  compare: defaultCompare,
  toSearchText: (v, m) => (v == null ? '' : labelOf(m, v)),
};

const multiSelect = {
  type: 'MULTI_SELECT',
  isSortable: false, // array de valores: sin hoja escalar por la que paginar
  schema: (m) => {
    const allowed = allowedValues(m);
    const item = allowed.length ? z.enum(allowed) : z.string();
    return nullable(z.array(item), m);
  },
  defaultValue: (m) => m?.defaultValue ?? [],
  normalize: (v) => (Array.isArray(v) ? v.map(String) : v == null ? [] : [String(v)]),
  filterOperators: OPERATORS.multiSelect,
  buildFilter: (fieldName, op, value) => {
    const path = dataPath(fieldName);
    switch (op) {
      case 'containsAny':
        return { [path]: { $in: value } };
      case 'containsAll':
        return { [path]: { $all: value } };
      case 'isEmpty':
        return {
          $or: [{ [path]: { $exists: false } }, { [path]: null }, { [path]: { $size: 0 } }],
        };
      case 'isNotEmpty':
        return { [path]: { $exists: true, $not: { $size: 0 } } };
      default:
        throw new Error(`Operador no soportado: ${op}`);
    }
  },
  compare: (a, b) => defaultCompare((a ?? []).length, (b ?? []).length),
  toSearchText: (v, m) => (Array.isArray(v) ? v.map((x) => labelOf(m, x)).join(' ') : ''),
};

export const choiceTypes = [select, multiSelect];
