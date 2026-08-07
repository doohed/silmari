import { test, expect } from '@playwright/test';
import { signup } from './helpers';


test('⌘K: llegar a un registro por teclado', async ({ page }) => {
  await signup(page);

  // Crear una empresa y ponerle un nombre buscable.
  await page.getByRole('navigation').getByRole('link', { name: 'Empresas' }).click();
  await page.getByRole('button', { name: /Crear empresas/i }).click();
  const cell = page.getByText('Sin título').first();
  await cell.dblclick();
  await page.locator('input:focus').fill('Zeta Corp');
  await page.keyboard.press('Enter');
  await expect(page.getByText('Zeta Corp')).toBeVisible();

  // Abrir el command menu solo con teclado y buscar.
  await page.keyboard.press('ControlOrMeta+k');
  await page.keyboard.type('Zeta');
  const dialog = page.locator('.cmdk-dialog');
  await expect(dialog.getByText('Zeta Corp')).toBeVisible();

  // Enter navega al registro.
  await page.keyboard.press('Enter');
  await expect(page).toHaveURL(/\/objects\/companies\/[a-f0-9]{24}$/);
  await expect(page.getByRole('button', { name: 'Zeta Corp' })).toBeVisible();
});
