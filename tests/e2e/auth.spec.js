import { test, expect } from '@playwright/test';

test('alta por email → onboarding → entra al workspace y cierra sesión', async ({ page }) => {
  const stamp = Date.now();
  const email = `e2e_${stamp}@test.dev`;
  const subdomain = `e2e-${stamp}`;

  // Alta por email (solo email + contraseña).
  await page.goto('/signup');
  await page.getByLabel('Email').fill(email);
  await page.getByLabel('Contraseña').fill('secret123');
  await page.getByRole('button', { name: 'Continuar' }).click();

  // Arranca el onboarding.
  await expect(page).toHaveURL(/\/onboarding$/);

  // Paso 1 — Crear workspace.
  await expect(page.getByRole('heading', { name: 'Crea tu espacio de trabajo' })).toBeVisible();
  await page.getByLabel('Nombre').fill('E2E Workspace');
  await page.locator('#subdomain').fill(subdomain);
  await page.getByRole('button', { name: 'Crear espacio de trabajo' }).click();

  // Paso 2 — Perfil.
  await expect(page.getByRole('heading', { name: 'Cuéntanos sobre ti' })).toBeVisible();
  await page.getByLabel('Nombre').fill('E2E');
  await page.getByRole('button', { name: 'Continuar' }).click();

  // Paso 3 — Invitar equipo (saltar).
  await expect(page.getByRole('heading', { name: 'Invita a tu equipo' })).toBeVisible();
  await page.getByRole('button', { name: 'Saltar' }).click();

  // Paso 4 — Plan (visual).
  await expect(page.getByRole('heading', { name: 'Mejora tu prueba gratuita' })).toBeVisible();
  await page.getByRole('button', { name: 'Continuar' }).click();

  // Paso 5 — Bienvenida.
  await expect(page.getByRole('heading', { name: /Todo listo/ })).toBeVisible();
  await page.getByRole('button', { name: /Entrar a/ }).click();

  // Entra a la app: nombre del workspace + rol propietario.
  await expect(page).toHaveURL('http://localhost:3000/');
  await expect(page.getByRole('heading', { name: 'E2E Workspace' })).toBeVisible();
  await expect(page.getByText('Propietario')).toBeVisible();

  // Cerrar sesión vuelve a la puerta de entrada.
  await page.getByRole('button', { name: 'Cerrar sesión' }).click();
  await expect(page).toHaveURL(/\/welcome$/);
});

test('la raíz sin sesión lleva a la puerta de entrada y las rutas protegidas a login', async ({
  page,
}) => {
  await page.goto('/');
  await expect(page).toHaveURL(/\/welcome$/);
  await expect(page.getByRole('heading', { name: /Bienvenido a/ })).toBeVisible();

  await page.goto('/settings/profile');
  await expect(page).toHaveURL(/\/login$/);
});
