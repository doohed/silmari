import { describe, it, expect, beforeAll } from 'vitest';

// El driver lee STORAGE_DIR al importarse, así que se fija antes.
process.env.STORAGE_DIR = '/tmp/silmari-storage';

let localStorage;
beforeAll(async () => {
  ({ localStorage } = await import('@/lib/storage/local'));
});

describe('rutas del storage local', () => {
  it('rechaza escapar de la carpeta base', async () => {
    await expect(localStorage.read('../../etc/passwd')).rejects.toThrow(/no válida/i);
    await expect(localStorage.read('ws/../../../etc/passwd')).rejects.toThrow(/no válida/i);
  });

  it('rechaza la carpeta hermana que comparte prefijo', async () => {
    // `startsWith(BASE)` a secas daba por buena "/tmp/silmari-storage-otro":
    // la comparación tiene que exigir el separador.
    await expect(localStorage.read('../silmari-storage-otro/secreto')).rejects.toThrow(
      /no válida/i,
    );
  });

  it('una key normal no se bloquea', async () => {
    // No existe el archivo: el fallo tiene que ser de lectura, no de la guardia.
    await expect(localStorage.read('workspace1/uuid-archivo.pdf')).rejects.toThrow(/ENOENT/);
  });
});
