import { test, expect } from '@playwright/test';
import { signup } from './helpers';


test('cambiar de tema aplica la clase dark', async ({ page }) => {
  await signup(page);
  await expect(page.locator('html')).not.toHaveClass(/dark/);
  await page.getByRole('button', { name: /tema oscuro/i }).click();
  await expect(page.locator('html')).toHaveClass(/dark/);
});

test('importar un CSV crea los registros', async ({ page }) => {
  await signup(page);
  await page.getByRole('navigation').getByRole('link', { name: 'Empresas' }).click();

  await page.getByRole('button', { name: 'Importar' }).click();
  await page.locator('input[type="file"]').setInputFiles({
    name: 'empresas.csv',
    mimeType: 'text/csv',
    buffer: Buffer.from('name,employees\nAcme CSV,10\nBeta CSV,20\n'),
  });

  const dialog = page.getByRole('dialog');
  await dialog.getByRole('button', { name: 'Importar' }).click();
  await expect(dialog.getByText(/2 importadas/i)).toBeVisible();

  await page.keyboard.press('Escape');
  await expect(page.getByText('Acme CSV')).toBeVisible();
  await expect(page.getByText('Beta CSV')).toBeVisible();
});
