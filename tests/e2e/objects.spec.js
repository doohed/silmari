import { test, expect } from '@playwright/test';
import { signup } from './helpers';

test('tras el signup, los objetos estándar aparecen en la navegación', async ({ page }) => {
  await signup(page, { workspace: 'Nav Co' });

  // El sidebar lista los objetos estándar generados desde la metadata.
  const nav = page.getByRole('navigation');
  await expect(nav.getByRole('link', { name: 'Empresas' })).toBeVisible();
  await expect(nav.getByRole('link', { name: 'Contactos' })).toBeVisible();
  await expect(nav.getByRole('link', { name: 'Oportunidades' })).toBeVisible();

  // Navegar a Empresas abre la vista tabla (dirigida por metadata), vacía al inicio.
  await nav.getByRole('link', { name: 'Empresas' }).click();
  await expect(page).toHaveURL(/\/objects\/companies$/);
  await expect(page.getByText(/Aún no hay empresas/i)).toBeVisible();
});
