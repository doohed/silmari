import { test, expect } from '@playwright/test';
import { signup } from './helpers';


test('crear un objeto custom con una relación a Company desde la UI', async ({ page }) => {
  await signup(page);
  await page.goto('/settings/data-model');

  // Crear el objeto.
  await page.getByRole('button', { name: /Nuevo objeto/i }).click();
  await page.getByLabel(/Nombre técnico/i).fill('producto');
  await page.getByLabel('Etiqueta singular').fill('Producto');
  await page.getByLabel('Etiqueta plural').fill('Productos');
  await page.getByRole('button', { name: 'Crear objeto' }).click();
  await expect(page).toHaveURL(/\/settings\/data-model\/productos$/);

  // Añadir un campo RELATION hacia Empresa.
  await page.getByRole('button', { name: /Añadir campo/i }).click();
  await page.getByLabel(/Nombre técnico/i).fill('fabricante');
  await page.getByLabel('Etiqueta', { exact: true }).fill('Fabricante');
  await page.getByLabel('Tipo').selectOption('RELATION');
  await page.getByLabel(/Objeto destino/i).selectOption({ label: 'Empresa' });
  await page.getByRole('button', { name: 'Crear campo' }).click();

  // El campo aparece con tipo RELATION.
  await expect(page.getByText('fabricante', { exact: true })).toBeVisible();
  await expect(page.getByText('RELATION', { exact: true })).toBeVisible();

  // El objeto aparece en la navegación tras recargar.
  await page.reload();
  await expect(page.getByRole('navigation').getByRole('link', { name: 'Productos' })).toBeVisible();
});
