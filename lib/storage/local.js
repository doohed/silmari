import 'server-only';
import { randomUUID } from 'node:crypto';
import { mkdir, writeFile, readFile, unlink } from 'node:fs/promises';
import { dirname, join, resolve } from 'node:path';

/**
 * Driver de storage sobre disco local (desarrollo). Implementa la misma interfaz
 * que usaría un driver de S3, así que cambiar de backend no toca el resto.
 */

const BASE = resolve(process.env.STORAGE_DIR || './storage');

/** Resuelve la ruta absoluta de una key, evitando escapes fuera de BASE. */
function pathFor(key) {
  const full = resolve(join(BASE, key));
  if (!full.startsWith(BASE)) throw new Error('Clave de storage no válida');
  return full;
}

export const localStorage = {
  /**
   * Guarda un binario. La key incluye el workspace para aislar por tenant.
   * @param {{ workspaceId: string, filename: string, buffer: Buffer }} input
   * @returns {Promise<{ key: string, size: number }>}
   */
  async put({ workspaceId, filename, buffer }) {
    const safeName =
      String(filename)
        .replace(/[^\w.\-]+/g, '_')
        .slice(0, 120) || 'file';
    const key = `${workspaceId}/${randomUUID()}-${safeName}`;
    const dest = pathFor(key);
    await mkdir(dirname(dest), { recursive: true });
    await writeFile(dest, buffer);
    return { key, size: buffer.length };
  },

  /** @param {string} key @returns {Promise<Buffer>} */
  async read(key) {
    return readFile(pathFor(key));
  },

  /** @param {string} key */
  async remove(key) {
    await unlink(pathFor(key)).catch(() => {});
  },
};
