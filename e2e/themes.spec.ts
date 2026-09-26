import { expect, test } from '@playwright/test';

test('theme switches in one click and survives navigation and reload', async ({ page }) => {
  await page.goto('/');
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'graphite');
  await expect(page.getByRole('button', { name: '切换到石墨主题' })).toHaveAttribute('aria-pressed', 'true');

  await page.getByRole('button', { name: '切换到暖砂主题' }).click();
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'sandstone');

  await page.getByRole('link', { name: /TxRay 可用/ }).click();
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'sandstone');

  await page.reload();
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'sandstone');
  await expect(page.getByRole('button', { name: '切换到暖砂主题' })).toHaveAttribute('aria-pressed', 'true');

  await page.getByRole('button', { name: '切换到冷白主题' }).click();
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'frost');
  await page.getByRole('button', { name: '切换到石墨主题' }).click();
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'graphite');

  await page.getByRole('button', { name: '切换到冷白主题' }).focus();
  await page.keyboard.press('Enter');
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'frost');
});
