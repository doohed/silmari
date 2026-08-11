import { getFieldType } from '@/lib/field-types';
import { createRecord, updateRecord, listRecords } from '@/lib/records/service';
import { matchesDedupeKey } from '@/lib/leads/dedupe';
import { normalizeKey } from '@/lib/leads/normalize-payload';

/**
 * Núcleo de ingesta compartido por la **entrada de leads** (`lib/leads`) y los
 * **formularios web** (`lib/forms`): traduce valores de texto plano a los tipos
 * compuestos del CRM, deduplica por un campo clave y crea o actualiza el registro.
 * Cero lógica de negocio duplicada entre ambos orígenes.
 */

/**
 * Coacciona un valor de texto plano al tipo compuesto del campo. `"Ana Ruiz"`
 * → `{ firstName, lastName }`, un email suelto → array de EMAILS. Para SELECT
 * acepta tanto el `value` de la opción como su etiqueta. El resto de la coerción
 * (fechas, números, booleanos) la hace la validación del registro.
 * @param {{ type: string, options?: Array }} field
 * @param {any} value
 */
export function coerceValue(field, value) {
  if (value === null || value === undefined || value === '') return null;
  const asArray = () => (Array.isArray(value) ? value : [value]);

  switch (field.type) {
    case 'FULL_NAME': {
      if (typeof value === 'object' && !Array.isArray(value)) return value;
      const parts = String(value).trim().split(/\s+/);
      return { firstName: parts.shift() ?? '', lastName: parts.join(' ') };
    }
    case 'EMAILS':
      return asArray()
        .map((v) => String(v).trim().toLowerCase())
        .filter(Boolean);
    case 'PHONES':
      return asArray()
        .map((v) => String(v).trim())
        .filter(Boolean);
    case 'LINKS':
      return asArray()
        .map((v) => (typeof v === 'object' ? v : { url: String(v).trim(), label: '' }))
        .filter((l) => l.url);
    case 'SELECT':
    case 'MULTI_SELECT': {
      const options = field.options ?? [];
      const match = (v) => {
        const key = normalizeKey(v);
        const opt = options.find(
          (o) => normalizeKey(o.value) === key || normalizeKey(o.label) === key,
        );
        return opt ? opt.value : v;
      };
      return field.type === 'MULTI_SELECT' ? asArray().map(match) : match(value);
    }
    default:
      return Array.isArray(value) ? value.join(', ') : value;
  }
}

/**
 * Busca un registro existente por el campo clave. `eq` no existe en todos los
 * tipos (EMAILS solo tiene `contains`, que es subcadena), así que se traen unos
 * pocos candidatos y se confirma la igualdad en memoria.
 * @returns {Promise<string|null>} id del registro existente, o null
 */
export async function findDuplicateByKey(ctx, { object, field, value }) {
  const needle = Array.isArray(value) ? value[0] : value;
  if (needle === null || needle === undefined || needle === '') return null;

  const ops = getFieldType(field.type).filterOperators;
  const operator = ops.includes('eq') ? 'eq' : ops.includes('contains') ? 'contains' : null;
  if (!operator) return null;

  const { records } = await listRecords(ctx, {
    objectSlug: object.slug,
    filters: [{ fieldName: field.name, operator, value: needle }],
    limit: 5,
  });
  const hit = records.find((r) => matchesDedupeKey(r.data?.[field.name], needle));
  return hit?.id ?? null;
}

/**
 * Aplica valores mapeados a un objeto: coacciona cada campo, deduplica por el
 * campo clave y crea (o actualiza, si ya existe) el registro.
 * @param {import('@/lib/auth/permissions').Ctx} ctx
 * @param {{ object: any, mappings: Array<{ source:string, fieldName:string }>,
 *   values: Record<string, any>, dedupeFieldName?: string|null, source?: string }} args
 * @returns {Promise<{ action: 'created'|'updated'|null, recordId: string|null,
 *   data: object, mapped: string[], ignored: string[] }>}
 */
export async function applyMappedValues(
  ctx,
  { object, mappings, values, dedupeFieldName, source },
) {
  const byName = new Map(object.fields.map((f) => [f.name, f]));
  const data = {};
  const mapped = [];
  for (const m of mappings) {
    if (!(m.source in values)) continue;
    const field = byName.get(m.fieldName);
    if (!field) continue; // el campo se borró tras configurar el mapeo
    const value = coerceValue(field, values[m.source]);
    if (value === null) continue;
    data[m.fieldName] = value;
    mapped.push(m.source);
  }
  const ignored = Object.keys(values).filter((k) => !mapped.includes(k));
  if (mapped.length === 0) return { action: null, recordId: null, data, mapped, ignored };

  let existingId = null;
  const dedupeField = dedupeFieldName ? byName.get(dedupeFieldName) : null;
  if (dedupeField && data[dedupeField.name] != null) {
    existingId = await findDuplicateByKey(ctx, {
      object,
      field: dedupeField,
      value: data[dedupeField.name],
    });
  }

  const result = existingId
    ? await updateRecord(ctx, { objectSlug: object.slug, recordId: existingId, data })
    : await createRecord(ctx, { objectSlug: object.slug, data, source: source ?? 'API' });

  return {
    action: existingId ? 'updated' : 'created',
    recordId: result.id,
    data,
    mapped,
    ignored,
  };
}
