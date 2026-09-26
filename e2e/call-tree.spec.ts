import { expect, test, type Page } from '@playwright/test';
import {
  ADDR,
  encodeAccountExecute,
  encodeAggregate3,
  encodeApprove,
  encodeHandleOpsPacked,
  encodeNestedAggregate3,
  encodeSafeExecTransaction,
  encodeTransfer,
} from './call-tree-fixtures';

// 调用树 E2E：fixtures 由 src/features/txray/decoder/call-tree/fixtures.ts
// 用 viem encodeFunctionData 离线生成（确定性），避免手抄 hex。

const AGGREGATE3_WITH_APPROVE_MAX = encodeAggregate3([
  { target: ADDR.usdc, allowFailure: false, callData: encodeApprove() },
]);

const AGGREGATE3_WITH_UNKNOWN = encodeAggregate3([
  {
    target: ADDR.usdc,
    allowFailure: false,
    callData: ('0xdeadbeef' + '00'.repeat(32)) as `0x${string}`,
  },
  {
    target: ADDR.usdc,
    allowFailure: false,
    callData: encodeTransfer(ADDR.recipient, 1n),
  },
]);

const NESTED_SEVEN = encodeNestedAggregate3(7);

const SAFE_DELEGATECALL = encodeSafeExecTransaction({
  to: ADDR.usdc,
  operation: 1,
  data: encodeApprove(),
});

const HANDLE_OPS = encodeHandleOpsPacked([
  {
    sender: ADDR.account,
    callData: encodeAccountExecute(ADDR.usdc, 0n, encodeApprove()),
  },
]);

async function fillCalldata(page: Page, calldata: string): Promise<void> {
  await page.getByRole('button', { name: 'calldata', exact: true }).click();
  await page.getByLabel('calldata', { exact: true }).fill(calldata);
  await expect(page.getByTestId('static-decode-notice')).toBeVisible();
}

async function pasteCalldata(page: Page, calldata: string): Promise<void> {
  await page.goto('/tools/txray/decoder');
  await fillCalldata(page, calldata);
}

test('单层 calldata 显示调用树与静态解码声明', async ({ page }) => {
  await page.goto('/tools/txray/decoder');
  await page.getByRole('button', { name: '无限授权示例' }).click();

  const tree = page.getByRole('tree');
  await expect(tree).toBeVisible();
  await expect(page.getByRole('heading', { name: '调用树（静态解码）' })).toBeVisible();
  await expect(page.getByTestId('static-decode-notice')).toContainText('静态解码');
  await expect(page.getByTestId('call-node')).toHaveCount(1);
  await expect(page.getByTestId('high-risk-badge')).toBeVisible();
  await expect(page.getByText('发现无限额度授权（max）')).toBeVisible();
});

test('产品示例可直接展开递归调用并进入解释文章', async ({ page }) => {
  await page.goto('/tools/txray/decoder');
  await page.getByRole('button', { name: '嵌套调用示例' }).click();

  await expect(page.getByTestId('call-node')).toHaveCount(3);
  await expect(page.getByText('发现无限额度授权（max）')).toBeVisible();
  await expect(
    page.getByRole('link', { name: '了解批量调用为什么容易隐藏风险' }),
  ).toHaveAttribute('href', '/articles/why-batched-transactions-hide-risk');
});

test('嵌套 multicall：高风险路径默认展开并给出批量提示', async ({ page }) => {
  await pasteCalldata(page, AGGREGATE3_WITH_APPROVE_MAX);

  await expect(page.getByText('Multicall3 · aggregate3 批量调用')).toBeVisible();
  // 子调用 approve 默认可见（高风险路径默认展开）
  await expect(page.getByTestId('call-node')).toHaveCount(2);
  await expect(page.getByText('发现无限额度授权（max）')).toBeVisible();
  await expect(page.getByText('批量调用中混入高风险授权')).toBeVisible();
  await expect(page.getByTestId('stop-reason')).toHaveCount(0);
});

test('调用树支持点击展开与收起', async ({ page }) => {
  await pasteCalldata(page, NESTED_SEVEN);

  const rootToggle = page.getByTestId('node-toggle').first();
  await expect(page.getByTestId('stop-reason').first()).toBeVisible();

  // 默认展开（存在停止提示的链），先全部收起再逐层展开
  await page.getByRole('button', { name: '全部收起' }).click();
  await expect(page.getByTestId('call-node')).toHaveCount(1);

  await rootToggle.click();
  await expect(page.getByTestId('call-node').nth(1)).toBeVisible();

  await page.getByRole('button', { name: '全部展开' }).click();
  const nodeCount = await page.getByTestId('call-node').count();
  expect(nodeCount).toBeGreaterThan(3);
});

test('未知子调用默认展开且可查看有限长度原始数据', async ({ page }) => {
  await pasteCalldata(page, AGGREGATE3_WITH_UNKNOWN);

  // "unknown 不等于 safe"：未知子调用不再被折叠隐藏，默认沿祖先链展开
  const unknownNode = page.locator('[data-status="unknown"]');
  await expect(unknownNode.first()).toBeVisible();
  await expect(page.getByText('未知调用').first()).toBeVisible();
  await expect(page.getByText('包含未知调用')).toBeVisible();
  // 容器上有子树未知/不完整计数徽章
  await expect(page.getByTestId('incomplete-badge').first()).toContainText('1');

  await page.getByText('原始数据（有限长度）').first().click();
  await expect(page.getByText(/0xdeadbeef[0-9a-f]*…?/).first()).toBeVisible();
});

test('达到最大深度时显示停止原因', async ({ page }) => {
  await pasteCalldata(page, NESTED_SEVEN);

  const stopReason = page.getByTestId('stop-reason');
  await expect(stopReason).toHaveCount(1);
  await expect(stopReason).toContainText('最大递归深度');
});

test('Safe DELEGATECALL 给出高风险提示', async ({ page }) => {
  await pasteCalldata(page, SAFE_DELEGATECALL);

  await expect(page.getByText('Safe · execTransaction')).toBeVisible();
  await expect(page.getByText('Safe 使用 DELEGATECALL')).toBeVisible();
});

test('ERC-4337 handleOps 展开 UserOperation 与内部调用', async ({ page }) => {
  await pasteCalldata(page, HANDLE_OPS);

  await expect(page.getByText('ERC-4337 EntryPoint · handleOps')).toBeVisible();
  await expect(page.getByText('UserOperation').first()).toBeVisible();
  await expect(page.getByText('智能账户 · execute')).toBeVisible();
  await expect(page.getByText(/发现无限额度授权/)).toBeVisible();
});

test('键盘可展开与收起调用树', async ({ page }) => {
  await pasteCalldata(page, NESTED_SEVEN);

  const rootToggle = page.getByTestId('node-toggle').first();
  await rootToggle.focus();
  await expect(rootToggle).toHaveAttribute('aria-expanded', 'true');
  await page.keyboard.press('ArrowLeft');
  await expect(rootToggle).toHaveAttribute('aria-expanded', 'false');
  await page.keyboard.press('ArrowRight');
  await expect(rootToggle).toHaveAttribute('aria-expanded', 'true');
});

test('中英文切换覆盖调用树文案', async ({ page }) => {
  await page.goto('/tools/txray/decoder');
  await page.getByRole('button', { name: 'English' }).click();
  await page.getByRole('button', { name: 'Unlimited approval sample' }).click();

  await expect(
    page.getByRole('heading', { name: 'Call tree (static decoding)' }),
  ).toBeVisible();
  await expect(page.getByTestId('static-decode-notice')).toContainText(
    'not a transaction simulation',
  );
  await expect(
    page.getByText('Unlimited (max) token allowance found'),
  ).toBeVisible();

  await page.getByRole('button', { name: '中文' }).click();
  await expect(page.getByRole('heading', { name: '调用树（静态解码）' })).toBeVisible();
});

test('切换已缓存的输入时默认展开按新树重算', async ({ page }) => {
  // 先加载 unknown 输入使其进入 TanStack Query 缓存（staleTime 60s）
  await pasteCalldata(page, AGGREGATE3_WITH_UNKNOWN);
  await expect(page.getByText('未知调用').first()).toBeVisible();

  // 再加载另一个输入（首次查询，树组件经历卸载重建），然后全部收起
  await fillCalldata(page, NESTED_SEVEN);
  await expect(page.getByTestId('stop-reason').first()).toBeVisible();
  await page.getByRole('button', { name: '全部收起' }).click();
  await expect(page.getByTestId('call-node')).toHaveCount(1);

  // 最后切回【已缓存】的 unknown 输入：数据同步可用、组件保持挂载。
  // 若没有按树身份重建组件，这里会继承上一步"全部收起"的展开状态，
  // 未按树身份重建时，未知节点会继承折叠状态并被隐藏。
  await fillCalldata(page, AGGREGATE3_WITH_UNKNOWN);

  await expect(page.getByText('未知调用').first()).toBeVisible();
  await expect(page.getByTestId('incomplete-badge').first()).toBeVisible();
});

test('移动端调用树不横向溢出', async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== 'mobile-chromium', 'mobile layout assertion');
  await pasteCalldata(page, NESTED_SEVEN);

  const overflow = await page.evaluate(
    () =>
      document.documentElement.scrollWidth - document.documentElement.clientWidth,
  );
  expect(overflow).toBeLessThanOrEqual(1);
  await expect(page.getByTestId('static-decode-notice')).toBeVisible();
});
