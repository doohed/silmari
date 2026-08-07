import { ValidationError } from '@/lib/errors/domain-errors';

/**
 * Valida `data` contra `schema`. Si falla, lanza ValidationError con los errores
 * por campo (compatibles con los formularios). Si pasa, devuelve los datos ya
 * parseados y normalizados por Zod.
 * @template T
 * @param {import('zod').ZodType<T>} schema
 * @param {unknown} data
 * @returns {T}
 */
export function parseOrThrow(schema, data) {
  const result = schema.safeParse(data);
  if (!result.success) {
    const { fieldErrors, formErrors } = result.error.flatten();
    throw new ValidationError(formErrors[0] || 'Revisa los datos del formulario', {
      fieldErrors,
    });
  }
  return result.data;
}
