import { test, expect } from '@playwright/test';
test('student dashboard and navigation fit a 390px phone', async ({ page }) => {
  await page.goto('/login');
  await page.getByRole('button', { name: 'Se connecter', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'Bonjour Amine 👋' })).toBeVisible();
  await expect(page.locator('.balance-amount')).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(
    true,
  );
  await page.screenshot({ path: '.local/screenshots/dashboard-mobile.png', fullPage: true });
  await page.getByRole('link', { name: 'Mes repas', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'Les bons moments se comptent.' })).toBeVisible();
  await expect(page.getByRole('table')).toBeVisible();
  expect(await page.evaluate(() => document.documentElement.scrollWidth <= window.innerWidth)).toBe(
    true,
  );
});
