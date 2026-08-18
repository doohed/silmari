import { defineConfig } from 'vitest/config';
import react from '@vitejs/plugin-react';
import { fileURLToPath } from 'node:url';

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      '@': fileURLToPath(new URL('./', import.meta.url)),
      // El guard `server-only` lanza fuera del runtime react-server (Vitest).
      // Un test de lógica pura puede acabar importando, por la cadena de
      // módulos, algo que lo incluya; aquí se neutraliza igual que en la
      // configuración de integración.
      'server-only': fileURLToPath(new URL('./tests/stubs/empty.js', import.meta.url)),
    },
  },
  test: {
    environment: 'jsdom',
    globals: true,
    setupFiles: ['./tests/setup.js'],
    include: ['tests/unit/**/*.test.js'],
  },
});
