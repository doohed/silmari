/**
 * Mensaje de error de un campo de formulario.
 * @param {{ message?: string }} props
 */
export function FormError({ message }) {
  if (!message) return null;
  return <p className="text-danger mt-1 text-xs">{message}</p>;
}

export default FormError;
