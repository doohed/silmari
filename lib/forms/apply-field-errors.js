/**
 * Aplica los errores por campo devueltos por un Server Action al estado de
 * React Hook Form.
 * @param {import('react-hook-form').UseFormSetError<any>} setError
 * @param {Record<string, string[]>} fieldErrors
 */
export function applyFieldErrors(setError, fieldErrors) {
  for (const [field, messages] of Object.entries(fieldErrors)) {
    if (messages?.length) setError(field, { type: 'server', message: messages[0] });
  }
}
