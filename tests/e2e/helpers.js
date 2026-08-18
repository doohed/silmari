import { expect } from '@playwright/test';

/**
 * Da de alta una cuenta por email y completa el onboarding de 5 pasos, dejando
 * la sesión en la app (`/`). Compartido por los specs que necesitan un
 * workspace ya listo (con los objetos estándar sembrados en el alta).
 *
 * @param {import('@playwright/test').Page} page
 * @param {{ name?: string, workspace?: string }} [opts]
 */
export async function signup(page, { name = 'Test', workspace = 'Acme' } = {}) {
  const stamp = `${Date.now()}${Math.floor(Math.random() * 1e6)}`;
  const email = `e2e_${stamp}@test.dev`;
  const subdomain = `e2e-${stamp}`;

  // Alta por email.
  await page.goto('/signup');
  await page.getByLabel('Email').fill(email);
  await page.getByLabel('Contraseña').fill('secret123');
  await page.getByRole('button', { name: 'Continuar' }).click();
  await expect(page).toHaveURL(/\/onboarding$/);

  // Paso 1 — Workspace (espera el render tras la transacción de alta).
  await expect(page.getByRole('heading', { name: 'Crea tu espacio de trabajo' })).toBeVisible();
  await page.getByLabel('Nombre').fill(workspace);
  await page.locator('#subdomain').fill(subdomain);
  await page.getByRole('button', { name: 'Crear espacio de trabajo' }).click();

  // Paso 2 — Perfil.
  await expect(page.getByRole('heading', { name: 'Cuéntanos sobre ti' })).toBeVisible();
  await page.getByLabel('Nombre').fill(name);
  await page.getByRole('button', { name: 'Continuar' }).click();

  // Paso 3 — Invitar (saltar).
  await page.getByRole('button', { name: 'Saltar' }).click();

  // Paso 4 — Plan. Sin claves de Stripe solo se ofrece el plan gratuito, así que
  // el botón es "Continuar gratis".
  await expect(page.getByRole('heading', { name: 'Elige tu plan' })).toBeVisible();
  await page.getByRole('button', { name: /Continuar/ }).click();

  // Paso 5 — Bienvenida.
  await page.getByRole('button', { name: /Entrar a/ }).click();
  await expect(page).toHaveURL('http://localhost:3000/');
}
