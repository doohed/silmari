import { getFieldType } from '@/lib/field-types';
import { isRootField } from '@/lib/records/field-path';

/**
 * Compone el texto plano buscable de un registro concatenando la representación
 * textual de cada campo (según su tipo).
 * @param {Array<object>} fields FieldMetadata DTOs del objeto
 * @param {Record<string, any>} data
 * @returns {string}
 */
export function buildSearchText(fields, data = {}) {
  const parts = [];
  for (const field of fields) {
    if (isRootField(field)) continue; // su valor no está en `data`
    const text = getFieldType(field.type).toSearchText(data[field.name], field);
    if (text) parts.push(text);
  }
  return parts.join(' ').trim();
}
