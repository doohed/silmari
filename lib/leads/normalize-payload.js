/**
 * Normaliza el payload de un lead entrante a una forma estable
 * `{ formId, leadId, createdTime, fields }`.
 *
 * Acepta las variantes con las que llega un lead de Meta según por dónde pase:
 * el objeto del webhook crudo (`entry[].changes[].value`), el lead recuperado de
 * la Graph API (`field_data: [{ name, values }]`) y el objeto ya aplanado que
 * produce el trigger de Zapier/Make. Es puro: no toca BD ni red.
 */

/** Claves de metadatos de Meta: no son respuestas del formulario. */
const RESERVED = new Set([
  'id',
  'lead_id',
  'leadgen_id',
  'form_id',
  'form_name',
  'page_id',
  'page_name',
  'ad_id',
  'ad_name',
  'adset_id',
  'adset_name',
  'adgroup_id',
  'adgroup_name',
  'campaign_id',
  'campaign_name',
  'created_time',
  'is_organic',
  'platform',
  'partner_name',
  'custom_disclaimer_responses',
  'field_data',
  'zap_meta_human_now',
  'zap_search_was_found_status',
]);

/** Envoltorios habituales cuando el payload viaja anidado. */
const ENVELOPES = ['data', 'lead', 'value', 'body', 'payload'];

/**
 * Normaliza el nombre de una pregunta para poder emparejarla de forma tolerante
 * (mayúsculas, acentos, signos y espacios). "¿Cuál es tu e-mail?" → `cual_es_tu_e_mail`.
 * @param {string} raw
 * @returns {string}
 */
export function normalizeKey(raw) {
  return String(raw ?? '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '');
}

/** Desenvuelve el payload hasta el objeto que contiene los datos del lead. */
function unwrap(payload) {
  let current = payload;
  // Webhook crudo de Meta: los datos van en entry[].changes[].value.
  const change = current?.entry?.[0]?.changes?.[0]?.value;
  if (change && typeof change === 'object') current = change;

  // Envoltorios genéricos, hasta 3 niveles (Zapier a veces anida "data.data").
  for (let depth = 0; depth < 3; depth += 1) {
    const key = ENVELOPES.find(
      (k) => current?.[k] && typeof current[k] === 'object' && !Array.isArray(current[k]),
    );
    if (!key) break;
    // Solo desenvolvemos si el nivel actual no trae ya respuestas propias.
    if (Array.isArray(current.field_data)) break;
    current = current[key];
  }
  return current && typeof current === 'object' ? current : {};
}

/** Un valor de `values` de Meta: un array de 1 se aplana al escalar. */
function unwrapValues(values) {
  if (!Array.isArray(values)) return values ?? null;
  return values.length === 1 ? values[0] : values;
}

/**
 * @param {any} payload Cuerpo recibido de Zapier/Make/Meta.
 * @returns {{ formId: string, leadId: string|null, createdTime: string|null, fields: Record<string, any> }}
 */
export function normalizeLeadPayload(payload) {
  const src = unwrap(payload);
  /** @type {Record<string, any>} */
  const fields = {};

  // Forma canónica de Meta: field_data con { name, values }.
  if (Array.isArray(src.field_data)) {
    for (const entry of src.field_data) {
      const key = normalizeKey(entry?.name);
      if (!key) continue;
      fields[key] = unwrapValues(entry.values);
    }
  }

  // Forma aplanada (Zapier): el resto de claves escalares son respuestas.
  for (const [rawKey, value] of Object.entries(src)) {
    const key = normalizeKey(rawKey);
    if (!key || RESERVED.has(key) || key in fields) continue;
    if (value === null || value === undefined) continue;
    if (typeof value === 'object' && !Array.isArray(value)) continue;
    fields[key] = value;
  }

  const formId = src.form_id ?? src.formId ?? '';
  const leadId = src.leadgen_id ?? src.lead_id ?? src.id ?? null;
  const createdTime = src.created_time ?? null;

  return {
    formId: formId === null || formId === undefined ? '' : String(formId),
    leadId: leadId === null ? null : String(leadId),
    createdTime: createdTime === null ? null : String(createdTime),
    fields,
  };
}

export default normalizeLeadPayload;
