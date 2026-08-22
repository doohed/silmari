/**
 * Cómo se **pide** y cómo se **interpreta** el valor de una condición de
 * automatización. Puro y sin dependencias, compartido con el cliente igual que
 * `lib/records/limits.js`: el panel elige el control con `conditionInputKind` y
 * el servicio valida con `castConditionValue`, así no hay dos ideas distintas de
 * qué es un valor aceptable.
 *
 * Existe porque el editor pedía **texto libre para todo** y los `buildFilter` de
 * los field-types comparan contra el valor ya tipado:
 * - un SELECT guarda `option.value` (el slug), así que escribir «Cliente» cuando
 *   el valor es `cliente` no casaba nunca;
 * - un BOOLEAN se filtra con `Boolean(value)`, y `Boolean('false') === true`,
 *   así que «no» era literalmente inexpresable.
 * Ninguno de los dos daba error: la regla simplemente no disparaba jamás.
 *
 * NUMBER y DATE no están aquí por gusto de simetría: sus `buildFilter` ya
 * castean (`Number(value)`, `new Date(value)`). Se normalizan igual para que el
 * valor guardado en la regla sea el que se ve, y para rechazar de entrada un
 * «tres» que se convertiría en `NaN` en silencio.
 */

/** Operadores que no llevan valor a la derecha. */
const NO_VALUE_OPERATORS = new Set(['isEmpty', 'isNotEmpty']);

/** Operadores cuyo valor es una lista. */
const LIST_OPERATORS = new Set(['isAnyOf', 'isNoneOf', 'containsAny', 'containsAll']);

/**
 * Qué control pinta el editor para el valor de una condición sobre este tipo.
 * @param {string} fieldType
 * @returns {'select'|'boolean'|'number'|'date'|'datetime'|'text'}
 */
export function conditionInputKind(fieldType) {
  switch (fieldType) {
    case 'SELECT':
    case 'MULTI_SELECT':
      return 'select';
    case 'BOOLEAN':
      return 'boolean';
    case 'NUMBER':
    case 'CURRENCY':
    case 'PERCENT':
    case 'RATING':
      return 'number';
    case 'DATE':
      return 'date';
    case 'DATE_TIME':
      return 'datetime';
    default:
      return 'text';
  }
}

/** ¿Este operador necesita un valor a la derecha? */
export function operatorTakesValue(operator) {
  return !NO_VALUE_OPERATORS.has(operator);
}

/** Valor inicial razonable al elegir campo/operador, para no arrancar en vacío. */
export function defaultConditionValue(field, operator) {
  if (!operatorTakesValue(operator)) return null;
  switch (conditionInputKind(field?.type)) {
    case 'select':
      return field?.options?.[0]?.value ?? '';
    case 'boolean':
      return true;
    default:
      return '';
  }
}

/** Casteo de un escalar suelto. Devuelve `{ ok, value }` o `{ ok:false, error }`. */
function castOne(value, field) {
  const kind = conditionInputKind(field?.type);
  if (kind === 'select') {
    const v = String(value ?? '');
    const options = field?.options ?? [];
    // Sin opciones declaradas no hay contra qué validar (no debería pasar en
    // SELECT, que las exige al crear el campo): se deja pasar el texto.
    if (options.length === 0) return { ok: true, value: v };
    const match = options.find((o) => o.value === v);
    if (match) return { ok: true, value: match.value };
    // Cortesía con quien escribió la etiqueta en vez del valor: se acepta y se
    // guarda el `value`, que es lo que compara el filtro.
    const byLabel = options.find((o) => String(o.label).toLowerCase() === v.toLowerCase());
    if (byLabel) return { ok: true, value: byLabel.value };
    return {
      ok: false,
      error: `"${v}" no es una opción de "${field.label}". Elige entre: ${options
        .map((o) => o.label)
        .join(', ')}`,
    };
  }
  if (kind === 'boolean') {
    if (typeof value === 'boolean') return { ok: true, value };
    const v = String(value ?? '')
      .trim()
      .toLowerCase();
    if (['true', 'sí', 'si', '1'].includes(v)) return { ok: true, value: true };
    if (['false', 'no', '0'].includes(v)) return { ok: true, value: false };
    return { ok: false, error: `"${field.label}" solo admite sí o no` };
  }
  if (kind === 'number') {
    const n = Number(value);
    if (value === '' || value === null || !Number.isFinite(n)) {
      return { ok: false, error: `"${field.label}" necesita un número` };
    }
    return { ok: true, value: n };
  }
  if (kind === 'date' || kind === 'datetime') {
    const d = new Date(value);
    if (!(d instanceof Date) || Number.isNaN(d.getTime())) {
      return { ok: false, error: `"${field.label}" necesita una fecha válida` };
    }
    return { ok: true, value: d.toISOString() };
  }
  return { ok: true, value: value == null ? '' : String(value) };
}

/**
 * Normaliza el valor de una condición contra la metadata real del campo.
 * No lanza: devuelve `{ ok:true, value }` o `{ ok:false, error }`, para poder
 * usarse igual en el cliente (aviso temprano) y en el servicio (donde el error
 * se convierte en `ValidationError`).
 * @param {any} value
 * @param {{ type: string, label: string, options?: {value:string,label:string}[] }} field
 * @param {string} operator
 */
export function castConditionValue(value, field, operator) {
  if (!operatorTakesValue(operator)) return { ok: true, value: null };
  if (LIST_OPERATORS.has(operator)) {
    const items = Array.isArray(value) ? value : [value];
    const out = [];
    for (const item of items) {
      const r = castOne(item, field);
      if (!r.ok) return r;
      out.push(r.value);
    }
    return { ok: true, value: out };
  }
  return castOne(value, field);
}
