import { test, expect } from '@playwright/test';

test('humo: la home responde y renderiza', async ({ page }) => {
  const res = await page.goto('/');
  expect(res?.status()).toBeLessThan(400);
  await expect(page.getByRole('heading', { level: 1 })).toBeVisible();
});
