import { defineConfig } from 'vitest/config';
import { fileURLToPath } from 'node:url';

// Tests de integración contra un mongodb-memory-server (replica set en memoria,
// para transacciones), arrancado en global-setup. No depende de Docker.
export default defineConfig({
  resolve: {
    alias: {
      '@': fileURLToPath(new URL('./', import.meta.url)),
      // El guard `server-only` lanza fuera del runtime react-server (Vitest/Node).
      // En tests neutralizamos el import con un módulo vacío.
      'server-only': fileURLToPath(new URL('./tests/stubs/empty.js', import.meta.url)),
    },
  },
  test: {
    environment: 'node',
    globals: true,
    include: ['tests/integration/**/*.test.js'],
    globalSetup: ['./tests/integration/global-setup.js'],
    setupFiles: ['./tests/integration/setup.js'],
    env: {
      AUTH_SECRET: 'test-secret-solo-para-tests',
      NODE_ENV: 'test',
    },
    // Sin paralelismo entre ficheros: comparten la misma instancia de BD.
    fileParallelism: false,
    testTimeout: 30_000,
    hookTimeout: 60_000,
  },
});
