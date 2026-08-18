/**
 * Utilidades de imagen para el cliente: reescala y recorta a un cuadrado y
 * devuelve un data URL pequeño, apto para guardar en `logoUrl`/`avatarUrl` sin
 * necesidad de almacenamiento externo.
 */

const ACCEPTED = ['image/png', 'image/jpeg', 'image/webp', 'image/gif'];

/**
 * Convierte un File de imagen en un data URL cuadrado reescalado (cover).
 * @param {File} file
 * @param {{ size?: number, type?: string, quality?: number }} [opts]
 * @returns {Promise<string>} data URL
 */
export async function fileToSquareDataUrl(
  file,
  { size = 256, type = 'image/webp', quality = 0.85 } = {},
) {
  if (!ACCEPTED.includes(file.type)) {
    throw new Error('Formato no admitido (usa PNG, JPG, WEBP o GIF)');
  }
  const bitmap = await loadBitmap(file);
  const canvas = document.createElement('canvas');
  canvas.width = size;
  canvas.height = size;
  const ctx = canvas.getContext('2d');

  // Cover: escala por el lado menor y centra el recorte.
  const scale = Math.max(size / bitmap.width, size / bitmap.height);
  const w = bitmap.width * scale;
  const h = bitmap.height * scale;
  ctx.drawImage(bitmap, (size - w) / 2, (size - h) / 2, w, h);

  return canvas.toDataURL(type, quality);
}

/** Carga un File como ImageBitmap (con fallback a HTMLImageElement). */
async function loadBitmap(file) {
  if (typeof createImageBitmap === 'function') {
    try {
      return await createImageBitmap(file);
    } catch {
      // continúa con el fallback
    }
  }
  const url = URL.createObjectURL(file);
  try {
    const img = await new Promise((resolve, reject) => {
      const el = new Image();
      el.onload = () => resolve(el);
      el.onerror = reject;
      el.src = url;
    });
    return img;
  } finally {
    URL.revokeObjectURL(url);
  }
}
