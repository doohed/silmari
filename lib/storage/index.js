import { localStorage } from '@/lib/storage/local';

/**
 * Devuelve el driver de storage activo. En dev es disco local; en producción se
 * cambiaría aquí por un driver de S3 con la misma interfaz `{ put, read, remove }`.
 */
export function getStorage() {
  return localStorage;
}
