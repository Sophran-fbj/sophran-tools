import { PERMIT2_ADDRESS, PERMIT2_PERMIT_ABIS } from './abis';
import { toFunctionSelector } from 'viem';
import type {
  CallNode,
  DecodeLimits,
  RiskCode,
  RiskFinding,
  RiskSeverity,
} from './types';

// 风险规则引擎：对调用树任意层级节点做静态检测。
//
// 原则（与产品边界一致）：
// - 只描述「发现了什么」，不判断合约恶意或交易安全；
// - 未知不等于恶意，解析成功也不等于安全；
// - 每条 finding 有稳定 code、指向具体 nodePath、带证据；
// - title / explanation 由 code 在 i18n 文案表解析（中英文）。

const PERMIT2_PERMIT_SELECTORS: ReadonlySet<string> = new Set(
  PERMIT2_PERMIT_ABIS.map((item) => toFunctionSelector(item)),
);

const ERC20_PERMIT_SELECTOR = '0xd505accf';
const ERC20_TRANSFER_FROM_SELECTOR = '0x23b872dd';

/** deadline 超过该天数视为「极长」。 */
const LONG_DEADLINE_DAYS = 30;
const DAY_MS = 24n * 60n * 60n * 1000n;

const BATCH_CONTAINER_KINDS = new Set([
  'multicall3-aggregate3',
  'multicall3-aggregate3Value',
  'multicall-bytes',
  'account-executeBatch',
  'entrypoint-handleOps',
  'entrypoint-handleOps-legacy',
]);

const PARSE_INCOMPLETE_STATUSES = new Set([
  'partial',
  'signature-only',
  'malformed',
  'recursion-stopped',
]);

export interface RiskOptions {
  /** 截止时间检查的参考时刻（毫秒）。测试可注入固定值保证确定性。 */
  nowMs: number;
  limits: DecodeLimits;
}

function finding(
  code: RiskCode,
  severity: RiskSeverity,
  node: CallNode,
  evidence: Record<string, string>,
): RiskFinding {
  return { code, severity, nodePath: node.path, evidence };
}

function paramByName(
  node: CallNode,
  name: string,
): { name: string; type: string; value: string } | null {
  const param = node.params.find((item) => item.name === name);
  return param ? { name: param.name ?? name, type: param.type, value: param.value } : null;
}

function isMaxWidthUint(type: string, value: string): boolean {
  const match = /^uint(\d{1,3})$/.exec(type);
  if (!match || !/^\d+$/.test(value)) return false;
  const bits = Number(match[1]);
  if (bits < 8 || bits > 256 || bits % 8 !== 0) return false;
  return BigInt(value) === 2n ** BigInt(bits) - 1n;
}

/** uint 类型 deadline（秒）→ 毫秒 bigint；非法返回 null。 */
function deadlineMs(value: string): bigint | null {
  if (!/^\d+$/.test(value)) return null;
  return BigInt(value) * 1000n;
}

function checkDeadline(
  findings: RiskFinding[],
  node: CallNode,
  name: string,
  value: string,
  nowMs: number,
): void {
  const ms = deadlineMs(value);
  if (ms === null) return;
  const now = BigInt(Math.max(0, Math.trunc(nowMs)));
  if (ms <= now) {
    findings.push(
      finding('deadline-suspicious', 'medium', node, {
        param: name,
        value,
        reason: 'expired',
      }),
    );
    return;
  }
  if (ms - now > BigInt(LONG_DEADLINE_DAYS) * DAY_MS) {
    findings.push(
      finding('deadline-suspicious', 'medium', node, {
        param: name,
        value,
        reason: 'too-long',
      }),
    );
  }
}

/** 对单个节点应用全部节点级规则。 */
function applyNodeRules(node: CallNode, options: RiskOptions): void {
  const results: RiskFinding[] = [];
  const fn = node.functionName;
  const selector = node.selector;
  const nowMs = options.nowMs;

  // ERC-20 max allowance：approve(spender, MAX)（选择器为准）。
  if (selector === '0x095ea7b3') {
    const amount = paramByName(node, 'amount') ?? paramByName(node, 'value');
    const spender = paramByName(node, 'spender');
    if (amount && isMaxWidthUint(amount.type, amount.value)) {
      results.push(
        finding('erc20-max-allowance', 'high', node, {
          spender: spender?.value ?? 'unknown',
          amount: amount.value,
        }),
      );
    }
  }

  // increaseAllowance。
  if (fn === 'increaseAllowance' || selector === '0x39509351') {
    const addedValue = paramByName(node, 'addedValue');
    results.push(
      finding('erc20-increase-allowance', 'medium', node, {
        addedValue: addedValue?.value ?? 'unknown',
      }),
    );
  }

  // setApprovalForAll(true)。
  if (fn === 'setApprovalForAll' || selector === '0xa22cb465') {
    const approved = paramByName(node, 'approved');
    const operator = paramByName(node, 'operator');
    if (approved?.value === 'true') {
      results.push(
        finding('nft-approval-for-all', 'high', node, {
          operator: operator?.value ?? 'unknown',
        }),
      );
    }
  }

  // ERC-20 permit。
  if (selector === ERC20_PERMIT_SELECTOR) {
    const spender = paramByName(node, 'spender');
    const deadline = paramByName(node, 'deadline');
    results.push(
      finding('erc20-permit', 'high', node, {
        spender: spender?.value ?? 'unknown',
        deadline: deadline?.value ?? 'unknown',
      }),
    );
    if (deadline) {
      checkDeadline(results, node, deadline.name, deadline.value, nowMs);
    }
  }

  // Permit2 permit（识别依据：目标为 Permit2 官方地址 + 官方接口选择器）。
  if (
    node.target?.toLowerCase() === PERMIT2_ADDRESS.toLowerCase() &&
    selector !== null &&
    PERMIT2_PERMIT_SELECTORS.has(selector)
  ) {
    const spender = paramByName(node, 'spender');
    const deadline =
      paramByName(node, 'sigDeadline') ?? paramByName(node, 'deadline');
    results.push(
      finding('permit2-permit', 'high', node, {
        spender: spender?.value ?? 'unknown',
        deadline: deadline?.value ?? 'unknown',
      }),
    );
    if (deadline) {
      checkDeadline(results, node, deadline.name, deadline.value, nowMs);
    }
  }

  // transferFrom。
  if (selector === ERC20_TRANSFER_FROM_SELECTOR) {
    const from = paramByName(node, 'from');
    const to = paramByName(node, 'to');
    results.push(
      finding('transfer-from', 'medium', node, {
        from: from?.value ?? 'unknown',
        to: to?.value ?? 'unknown',
      }),
    );
  }

  // Safe DELEGATECALL（operation == 1）。
  if (
    node.container?.kind === 'safe-execTransaction' ||
    node.sourceKind === 'safe-inner-call'
  ) {
    const operation = paramByName(node, 'operation');
    if (operation?.value === '1') {
      results.push(
        finding('safe-delegatecall', 'high', node, {
          operation: operation.value,
          target: node.target ?? 'unknown',
        }),
      );
    }
  }

  // 非零 native value。
  if (node.value !== null && /^\d+$/.test(node.value) && BigInt(node.value) > 0n) {
    results.push(
      finding('nonzero-native-value', 'low', node, { value: node.value }),
    );
  }

  // 未知 target（无法给出目标地址）。
  if (node.target === null && node.decodeStatus !== 'malformed') {
    results.push(finding('unknown-target', 'info', node, {}));
  }

  // 未知 selector。
  if (node.decodeStatus === 'unknown') {
    results.push(
      finding('unknown-selector', 'info', node, { selector: selector ?? 'unknown' }),
    );
  }

  // 解析不完整。
  if (PARSE_INCOMPLETE_STATUSES.has(node.decodeStatus)) {
    results.push(
      finding('parse-incomplete', 'medium', node, {
        decodeStatus: node.decodeStatus,
      }),
    );
  }

  // 递归限制。
  if (node.stopReason === 'max-depth') {
    results.push(finding('depth-limit-reached', 'low', node, {}));
  }
  if (node.stopReason === 'max-nodes') {
    results.push(finding('node-limit-reached', 'low', node, {}));
  }

  // UserOperation factory / paymaster。
  if (node.userOp?.factory) {
    results.push(
      finding('userop-factory', 'medium', node, { factory: node.userOp.factory }),
    );
  }
  if (node.userOp?.paymaster) {
    results.push(
      finding('userop-paymaster', 'info', node, {
        paymaster: node.userOp.paymaster,
      }),
    );
  }

  // 子调用允许失败。
  if (node.allowFailure === true) {
    results.push(finding('subcall-allow-failure', 'low', node, {}));
  }

  node.riskFindings.push(...results);
}

/**
 * 批量容器聚合规则：子树中混入高风险授权时在容器节点上给出提示。
 * 必须在子节点 findings 计算完成后运行（后序遍历）。
 */
function applyBatchAggregation(node: CallNode): void {
  if (!node.container || !BATCH_CONTAINER_KINDS.has(node.container.kind)) return;
  const highPaths: string[] = [];
  const codes: string[] = [];
  const collect = (current: CallNode): void => {
    for (const child of current.children) {
      for (const item of child.riskFindings) {
        if (item.severity === 'high') {
          highPaths.push(child.path);
          codes.push(item.code);
        }
      }
      collect(child);
    }
  };
  collect(node);
  if (highPaths.length === 0) return;
  node.riskFindings.push(
    finding('batch-contains-high-risk', 'high', node, {
      highRiskPaths: highPaths.join(','),
      highRiskCodes: codes.join(','),
    }),
  );
}

/** 构建完成后调用：遍历树，填充 riskFindings（先子后父）。 */
export function collectRiskFindings(root: CallNode, options: RiskOptions): void {
  const visit = (node: CallNode): void => {
    for (const child of node.children) {
      visit(child);
    }
    applyNodeRules(node, options);
    applyBatchAggregation(node);
  };
  visit(root);
}
