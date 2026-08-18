import { test, expect } from '@playwright/test';
import { signup } from './helpers';

test('abrir ficha, editar el identificador y ver el timeline', async ({ page }) => {
  await signup(page);

  await page.getByRole('navigation').getByRole('link', { name: 'Empresas' }).click();
  await page.getByRole('button', { name: /Crear empresas/i }).click();
  await expect(page.getByText('Sin título').first()).toBeVisible();

  // Abrir la ficha del registro.
  await page.getByRole('button', { name: 'Abrir registro' }).first().click({ force: true });
  await expect(page).toHaveURL(/\/objects\/companies\/[a-f0-9]{24}$/);

  // Editar el identificador en la cabecera.
  await page.getByText('Sin título').click();
  const input = page.locator('input:focus');
  await input.fill('Acme Ficha');
  await page.keyboard.press('Enter');
  // El identificador de la cabecera (un botón editable) muestra el nuevo valor.
  await expect(page.getByRole('button', { name: 'Acme Ficha' })).toBeVisible();

  // El timeline refleja la creación y el cambio.
  await expect(page.getByText(/creó el registro/i)).toBeVisible();
  await expect(page.getByText(/cambió Nombre/i)).toBeVisible();

  // Persiste tras recargar.
  await page.reload();
  await expect(page.getByRole('button', { name: 'Acme Ficha' })).toBeVisible();
});
