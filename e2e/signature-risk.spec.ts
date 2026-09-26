import { expect, test } from '@playwright/test';

test('signature input explains its limits and distinguishes invalid from partial data', async ({ page }) => {
  await page.goto('/tools/signature-risk');

  await page.getByText('需要粘贴什么？').click();
  await expect(page.getByText(/本站不能自动读取这个弹窗/)).toBeVisible();

  const input = page.getByLabel('Typed-data JSON');
  await input.fill('not json');
  await page.getByRole('button', { name: '分析', exact: true }).click();
  await expect(page.getByRole('alert').filter({ hasText: '输入不是有效的 JSON' })).toBeVisible();

  await input.fill(JSON.stringify({ message: { spender: '0xE592427A0AEce92De3Edee1F18E0157C05861564' } }));
  await page.getByRole('button', { name: '分析', exact: true }).click();
  await expect(page.getByText(/只显示识别到的字段线索/)).toBeVisible();

  await page.getByRole('button', { name: 'ERC-20 permit 示例' }).click();
  await expect(page.getByText('ERC-20 permit 授权', { exact: true })).toBeVisible();
  await expect(page.getByText(/只显示识别到的字段线索/)).toHaveCount(0);
});
