import { test, expect } from '@playwright/test';
import { signup } from './helpers';

// El arrastre en sí (cambio de etapa + posición + timeline) se verifica en
// tests/integration/kanban.test.js; dnd-kit no registra bien el gesto del ratón
// de Playwright (PointerSensor). Aquí verificamos el render del kanban.
test('la vista kanban se genera y agrupa por etapa', async ({ page }) => {
  await signup(page);

  await page.getByRole('navigation').getByRole('link', { name: 'Oportunidades' }).click();
  await page.getByRole('button', { name: /Crear oportunidades/i }).click();
  await expect(page.getByText('Sin título').first()).toBeVisible();

  // Cambiar a la vista Kanban (auto-creada).
  await page.getByRole('link', { name: 'Kanban' }).click();

  // Columnas desde las opciones del SELECT de agrupación + "Sin asignar".
  await expect(page.getByTestId('board-col-new')).toBeVisible();
  await expect(page.getByTestId('board-col-proposal')).toBeVisible();
  await expect(page.getByTestId('board-col-won')).toBeVisible();
  await expect(page.getByTestId('board-col-__none__')).toBeVisible();

  // El registro sin etapa aparece en "Sin asignar".
  await expect(page.getByTestId('board-col-__none__').getByTestId('board-card')).toHaveCount(1);
  await expect(page.getByTestId('board-col-new').getByTestId('board-card')).toHaveCount(0);
});
