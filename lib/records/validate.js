import { getFieldType, isWritableField } from '@/lib/field-types';
import { ValidationError } from '@/lib/errors/domain-errors';

/**
 * Valida y normaliza el `data` entrante de un registro contra la metadata del
 * objeto. Rechaza claves desconocidas y valores inválidos por tipo. Nunca se
 * confía en la metadata del cliente: `fields` viene resuelto del servidor.
 *
 * @param {Array<object>} fields  FieldMetadata DTOs del objeto (activos)
 * @param {Record<string, any>} incoming  data que envía el cliente
 * @param {{ partial?: boolean }} [opts]  partial=true para PATCH (no aplica defaults)
 * @returns {Record<string, any>} data normalizado, solo con campos conocidos
 */
export function validateAndNormalize(fields, incoming = {}, { partial = false } = {}) {
  const byName = new Map(fields.map((f) => [f.name, f]));
  /** @type {Record<string, string[]>} */
  const errors = {};

  for (const key of Object.keys(incoming)) {
    if (!byName.has(key)) errors[key] = ['Campo no reconocido'];
  }

  const out = {};
  for (const field of fields) {
    const def = getFieldType(field.type);
    const provided = Object.prototype.hasOwnProperty.call(incoming, field.name);

    // Campos de sistema: viven en la raíz del documento y los escribe el
    // servidor. Nunca entran en `data`, ni siquiera con valor por defecto.
    if (!isWritableField(field)) {
      if (provided) errors[field.name] = [`"${field.label}" es de solo lectura`];
      continue;
    }

    let value;
    if (provided) {
      const parsed = def.schema(field).safeParse(incoming[field.name]);
      if (!parsed.success) {
        const flat = parsed.error.flatten();
        errors[field.name] = [
          ...flat.formErrors,
          ...Object.values(flat.fieldErrors ?? {}).flat(),
        ].filter(Boolean);
        if (errors[field.name].length === 0) errors[field.name] = ['Valor no válido'];
        continue;
      }
      value = def.normalize(parsed.data, field);
    } else {
      if (partial) continue; // PATCH: no tocar los campos ausentes
      value = def.normalize(def.defaultValue(field), field);
    }

    if (field.isNullable === false && (value === null || value === undefined || value === '')) {
      errors[field.name] = [`"${field.label}" es obligatorio`];
      continue;
    }
    if (value !== undefined) out[field.name] = value;
  }

  if (Object.keys(errors).length) {
    throw new ValidationError('Datos no válidos', { fieldErrors: errors });
  }
  return out;
}
