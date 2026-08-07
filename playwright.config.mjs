import { defineConfig, devices } from '@playwright/test';

export default defineConfig({
  testDir: './tests/e2e',
  timeout: 30_000,
  fullyParallel: true,
  // Cada spec hace un alta + onboarding completo, que siembra objetos + índices
  // en una transacción; bajo concurrencia el dev server puede dar un fallo
  // transitorio. Con 2 workers + 1 reintento la suite es estable sin enmascarar
  // fallos reales (los flaky se ven en el reporte).
  retries: 1,
  workers: 2,
  reporter: 'list',
  use: {
    baseURL: 'http://localhost:3000',
    trace: 'on-first-retry',
  },
  projects: [{ name: 'chromium', use: { ...devices['Desktop Chrome'] } }],
  webServer: {
    command: 'npm run dev',
    url: 'http://localhost:3000',
    reuseExistingServer: !process.env.CI,
    timeout: 120_000,
  },
});
