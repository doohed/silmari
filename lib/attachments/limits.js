/**
 * Límites de subida de adjuntos. Módulo puro (sin BD ni red) para poder
 * testearlo y para compartirlo entre el route handler y el cliente.
 */

/** Tamaño máximo por archivo. */
export const MAX_UPLOAD_BYTES = 10 * 1024 * 1024; // 10 MB

/**
 * Tipos admitidos. Es una **lista blanca** a propósito: con lista negra siempre
 * se escapa algo. Fuera quedan los ejecutables y, sobre todo, `text/html` y
 * `image/svg+xml`, que el navegador ejecutaría como documento si se sirvieran
 * en línea desde nuestro propio origen.
 */
export const ALLOWED_MIME_TYPES = new Set([
  'image/jpeg',
  'image/png',
  'image/gif',
  'image/webp',
  'image/avif',
  'application/pdf',
  'text/plain',
  'text/csv',
  'application/msword',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'application/vnd.ms-excel',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  'application/vnd.ms-powerpoint',
  'application/vnd.openxmlformats-officedocument.presentationml.presentation',
  'application/zip',
]);

/**
 * Tipos que se pueden mostrar dentro del navegador sin riesgo. El resto se
 * fuerza a descarga con `Content-Disposition: attachment`, para que un archivo
 * subido no se convierta en una página de nuestro dominio.
 */
const INLINE_SAFE = new Set([
  'image/jpeg',
  'image/png',
  'image/gif',
  'image/webp',
  'image/avif',
  'application/pdf',
  'text/plain',
]);

/**
 * Valida tamaño y tipo.
 * @param {{ size: number, mimeType: string }} file
 * @returns {{ ok: true } | { ok: false, message: string }}
 */
export function validateUpload({ size, mimeType }) {
  if (!Number.isFinite(size) || size <= 0) {
    return { ok: false, message: 'El archivo está vacío' };
  }
  if (size > MAX_UPLOAD_BYTES) {
    const mb = Math.round(MAX_UPLOAD_BYTES / 1024 / 1024);
    return { ok: false, message: `El archivo supera el límite de ${mb} MB` };
  }
  // Se ignoran los parámetros del tipo (p. ej. "text/plain; charset=utf-8").
  const base = String(mimeType ?? '')
    .split(';')[0]
    .trim()
    .toLowerCase();
  if (!ALLOWED_MIME_TYPES.has(base)) {
    return { ok: false, message: `Tipo de archivo no admitido: ${base || 'desconocido'}` };
  }
  return { ok: true };
}

/**
 * `Content-Disposition` con el que servir un adjunto.
 * @param {{ mimeType: string, name: string }} file
 * @returns {string}
 */
export function contentDisposition({ mimeType, name }) {
  const base = String(mimeType ?? '')
    .split(';')[0]
    .trim()
    .toLowerCase();
  const mode = INLINE_SAFE.has(base) ? 'inline' : 'attachment';
  return `${mode}; filename*=UTF-8''${encodeURIComponent(name ?? 'archivo')}`;
}
