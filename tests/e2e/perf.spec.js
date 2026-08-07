import { readFileSync } from 'node:fs';
import { test, expect } from '@playwright/test';

const EMAIL_FILE =
  '/private/tmp/claude-501/-Users-dohed-Code-web-silmari/3ee4cb40-9e6d-4839-835f-70c1d6e5fb10/scratchpad/perf-email.txt';

test('la tabla virtualiza 5.000 registros (pocas filas en el DOM)', async ({ page }) => {
  let email;
  try {
    email = readFileSync(EMAIL_FILE, 'utf8').trim();
  } catch {
    test.skip(true, 'No hay dataset de rendimiento sembrado');
    return;
  }

  await page.goto('/login');
  await page.getByLabel('Email').fill(email);
  await page.getByLabel('Contraseña').fill('secret123');
  await page.getByRole('button', { name: 'Iniciar sesión' }).click();
  await expect(page).toHaveURL('http://localhost:3000/');

  const start = Date.now();
  await page.getByRole('navigation').getByRole('link', { name: 'Empresas' }).click();
  // Orden por defecto: manual por `position` (orden de creación) → arriba está
  // el primero sembrado.
  await expect(page.getByText('Company 1', { exact: true })).toBeVisible();
  const elapsed = Date.now() - start;

  // Virtualización: solo se renderiza una ventana de filas, no las 5.000.
  const rendered = await page.getByTestId('record-row').count();
  expect(rendered).toBeGreaterThan(0);
  expect(rendered).toBeLessThan(150);

  // La primera pintura de la tabla es rápida.
  expect(elapsed).toBeLessThan(8000);
});
