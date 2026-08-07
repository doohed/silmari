const ARRAY_OPS = new Set(['isAnyOf', 'isNoneOf', 'containsAny', 'containsAll']);
const NO_VALUE_OPS = new Set(['isEmpty', 'isNotEmpty']);

/**
 * Parsea los parámetros de listado de la API a la forma que espera `listRecords`.
 *
 * Formato: `?filter=campo:op:valor` (repetible), `?sort=campo:asc|desc`
 * (repetible), `?cursor=...`, `?limit=...`, `?includeDeleted=true`.
 *
 * @param {URLSearchParams} searchParams
 */
export function parseListParams(searchParams) {
  const filters = [];
  for (const raw of searchParams.getAll('filter')) {
    const [fieldName, operator, ...rest] = raw.split(':');
    if (!fieldName || !operator) continue;
    let value;
    if (NO_VALUE_OPS.has(operator)) value = undefined;
    else {
      const joined = rest.join(':');
      value = ARRAY_OPS.has(operator) ? joined.split(',') : joined;
    }
    filters.push({ fieldName, operator, value });
  }

  const sorts = [];
  for (const raw of searchParams.getAll('sort')) {
    const [fieldName, direction] = raw.split(':');
    if (fieldName) sorts.push({ fieldName, direction: direction === 'desc' ? 'desc' : 'asc' });
  }

  return {
    filters,
    sorts,
    cursor: searchParams.get('cursor') ?? undefined,
    limit: searchParams.get('limit') ?? undefined,
    includeDeleted: searchParams.get('includeDeleted') === 'true',
  };
}
