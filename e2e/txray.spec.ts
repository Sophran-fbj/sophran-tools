import { expect, test } from '@playwright/test';

test('approval demo is usable and persists the English locale', async ({ page }) => {
  await page.goto('/tools/txray/approvals?demo=1');

  await expect(page.getByRole('heading', { name: '授权检查' })).toBeVisible();
  await expect(page.getByText('USDC', { exact: true })).toBeVisible();
  await expect(page.getByText('WETH', { exact: true })).toBeVisible();
  await expect(page.getByText('BAYC', { exact: true })).toBeVisible();

  await page.getByRole('button', { name: 'English' }).click();
  await expect(page.getByRole('heading', { name: 'Approval check' })).toBeVisible();
  await expect(page.getByText('3 active approvals')).toBeVisible();
  await expect(page.getByText('Unlimited', { exact: true }).first()).toBeVisible();

  await page.reload();
  await expect(page.getByRole('heading', { name: 'Approval check' })).toBeVisible();
});

test('approval rows switch between table rows and mobile cards', async ({ page }, testInfo) => {
  await page.goto('/tools/txray/approvals?demo=1');
  const firstRow = page.locator('tbody tr').first();
  const tableHeader = page.locator('thead');

  if (testInfo.project.name === 'mobile-chromium') {
    await expect(firstRow).toHaveCSS('display', 'block');
    await expect(tableHeader).toHaveCSS('display', 'none');
    await expect(firstRow.getByText('资产', { exact: true })).toBeVisible();
  } else {
    await expect(firstRow).toHaveCSS('display', 'table-row');
    await expect(tableHeader).toHaveCSS('display', 'table-header-group');
  }

  await expect(firstRow.locator('[aria-live="polite"]')).toHaveCount(1);
  await expect(firstRow.getByTitle('连接该地址的钱包才能撤销')).toBeDisabled();
});

test('approval sorting changes display order without losing entries', async ({ page }) => {
  await page.goto('/tools/txray/approvals?demo=1');
  await page.getByLabel('排序').selectOption('asset');
  await expect(page.locator('tbody tr')).toHaveCount(3);
  await expect(page.locator('tbody tr').first()).toContainText('BAYC');
  await expect(page.getByText('显示 3 / 3 条授权')).toBeVisible();
});

test('decoder localizes and decodes known calldata without a wallet', async ({ page }) => {
  await page.goto('/tools/txray/decoder');
  await page.getByRole('button', { name: 'English' }).click();
  await page.getByRole('button', { name: 'Unlimited approval sample' }).click();

  await expect(page.getByRole('heading', { name: 'Transaction decoder' })).toBeVisible();
  // 函数名同时出现在参数卡与调用树节点中，取第一个即可
  await expect(page.getByText('approve', { exact: true }).first()).toBeVisible();
  await expect(page.getByText('⚠️ High risk', { exact: true })).toBeVisible();
  await expect(page.getByText('Unlimited (max uint256)')).toBeVisible();
  await expect(page.getByText(/Allows the spender to use your tokens/)).toBeVisible();
});

test('decoder parameters use cards on mobile', async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== 'mobile-chromium', 'mobile layout assertion');
  await page.goto('/tools/txray/decoder');
  await page.getByRole('button', { name: '无限授权示例' }).click();

  const firstParameter = page.locator('tbody tr').first();
  await expect(firstParameter).toHaveCSS('display', 'block');
  await expect(firstParameter.getByText('参数:', { exact: true })).toBeVisible();
});

test('decoder keeps transaction hashes and calldata in separate input modes', async ({ page }) => {
  await page.goto('/tools/txray/decoder');
  await page.getByLabel('交易哈希', { exact: true }).fill('0x095ea7b3');
  await expect(page.getByText(/请输入 0x 开头、后接 64 位/)).toBeVisible();
  await page.getByRole('button', { name: 'calldata', exact: true }).click();
  await expect(page.getByLabel('calldata', { exact: true })).toHaveValue('');
  await page.getByRole('button', { name: '无限授权示例' }).click();
  await expect(page.getByText(/仅解读粘贴的 calldata/)).toBeVisible();
});
