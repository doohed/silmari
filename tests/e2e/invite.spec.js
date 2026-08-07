import { test, expect } from '@playwright/test';
import { signup } from './helpers';


test('invitar a un miembro genera un enlace de invitación', async ({ page }) => {
  await signup(page);
  await page.goto('/settings/members');

  await page.getByPlaceholder('email@empresa.com').fill('nuevo@empresa.com');
  await page.getByRole('button', { name: 'Invitar' }).click();

  // En dev se muestra el enlace de invitación para copiar.
  await expect(page.getByText(/enlace de invitación/i)).toBeVisible();
  await expect(page.locator('code')).toContainText('/invite/');
});
