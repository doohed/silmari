import { test, expect } from '@playwright/test';
import { signup } from './helpers';


test('crear registro y editar una celda inline (persistente)', async ({ page }) => {
  await signup(page);

  await page.getByRole('navigation').getByRole('link', { name: 'Empresas' }).click();
  await expect(page).toHaveURL(/\/objects\/companies$/);

  // Estado vacío → crear el primer registro.
  await expect(page.getByText(/Aún no hay empresas/i)).toBeVisible();
  await page.getByRole('button', { name: /Crear empresas/i }).click();

  // Aparece una fila con el título por defecto.
  const cell = page.getByText('Sin título').first();
  await expect(cell).toBeVisible();

  // Edición inline de la celda del nombre.
  await cell.dblclick();
  const input = page.locator('input:focus');
  await input.fill('Acme Test');
  await page.keyboard.press('Enter');
  await expect(page.getByText('Acme Test')).toBeVisible();

  // Persiste tras recargar.
  await page.reload();
  await expect(page.getByText('Acme Test')).toBeVisible();
});
