import { test, expect } from '@playwright/test';
import { signup } from './helpers';


test('una nota creada desde una empresa aparece en el contacto vinculado', async ({ page }) => {
  await signup(page);
  const nav = page.getByRole('navigation');

  // Crear un contacto.
  await nav.getByRole('link', { name: 'Contactos' }).click();
  await page.getByRole('button', { name: /Crear contactos/i }).click();
  await expect(page.getByTestId('record-row')).toHaveCount(1);

  // Crear una empresa y abrir su ficha.
  await nav.getByRole('link', { name: 'Empresas' }).click();
  await page.getByRole('button', { name: /Crear empresas/i }).click();
  await page.getByRole('button', { name: 'Abrir registro' }).first().click({ force: true });
  await expect(page).toHaveURL(/\/objects\/companies\/[a-f0-9]{24}$/);

  // Notas → nueva nota vinculada también al contacto.
  await page.getByRole('button', { name: 'Notas' }).click();
  await page.getByRole('button', { name: /Nueva nota/i }).click();
  await page.getByPlaceholder('Título').fill('Reunión inicial');
  await page.getByRole('button', { name: /Vincular a otro registro/i }).click();
  await page.locator('select').selectOption({ label: 'Contacto' });
  const option = page.getByRole('button', { name: '(sin nombre)' }).first();
  await expect(option).toBeVisible({ timeout: 15000 });
  await option.click();
  // El contacto queda vinculado (chip visible) antes de guardar.
  await page.getByRole('button', { name: 'Guardar nota' }).click();
  await expect(page.getByText('Reunión inicial')).toBeVisible();

  // La nota aparece en la ficha del contacto.
  await nav.getByRole('link', { name: 'Contactos' }).click();
  await page.getByRole('button', { name: 'Abrir registro' }).first().click({ force: true });
  await page.getByRole('button', { name: 'Notas' }).click();
  await expect(page.getByText('Reunión inicial')).toBeVisible();
});
