import { describe, expect, it } from 'vitest';
import {
  ADDR,
  EMPTY_AGGREGATE3,
  EMPTY_EXECUTE_BATCH,
  MALFORMED,
  MAX_UINT256,
  SAFE_SIGNATURES_LOOKS_LIKE_APPROVE,
  encodeAccountExecute,
  encodeAccountExecuteBatch,
  encodeAggregate3,
  encodeAggregate3Value,
  encodeApprove,
  encodeHandleOpsLegacy,
  encodeHandleOpsPacked,
  encodeHugeAggregate3,
  encodeIncreaseAllowance,
  encodeMulticallBytes,
  encodeNestedAggregate3,
  encodePermit,
  encodeSafeExecTransaction,
  encodeSetApprovalForAll,
  encodeTransfer,
  encodeTransferFrom,
} from './fixtures';
import { buildCallTree, subtreeHasHighRisk } from './decode';
import type { CallNode, RiskFinding } from './types';

const FIXED_NOW_MS = 1_750_000_000_000; // 2025-07-15 前后的固定时刻，保证 deadline 测试确定性
const NOW_SEC = BigInt(Math.floor(FIXED_NOW_MS / 1000));

function collect(node: CallNode): CallNode[] {
  return [node, ...node.children.flatMap(collect)];
}

function findingsOf(node: CallNode, code: string): RiskFinding[] {
  return collect(node).flatMap((item) =>
    item.riskFindings.filter((finding) => finding.code === code),
  );
}

describe('buildCallTree: 普通单层调用', () => {
  it('解码 approve：状态 decoded、参数完整、无子节点', () => {
    const data = encodeApprove(ADDR.spender, 1000n);
    const result = buildCallTree({ to: ADDR.usdc, data });

    expect(result.root.decodeStatus).toBe('decoded');
    expect(result.root.functionName).toBe('approve');
    expect(result.root.selector).toBe('0x095ea7b3');
    expect(result.root.params).toHaveLength(2);
    expect(result.root.params[0]).toMatchObject({
      name: 'spender',
      value: '0xE592427A0AEce92De3Edee1F18E0157C05861564',
      isAddress: true,
    });
    expect(result.root.params[1]).toMatchObject({ value: '1000' });
    expect(result.root.children).toHaveLength(0);
    expect(result.nodeCount).toBe(1);
  });

  it('转账携带非零 native value 时记录到节点', () => {
    const result = buildCallTree({
      to: ADDR.recipient,
      value: 1_000_000n,
      data: encodeTransfer(ADDR.recipient, 5n),
    });
    expect(result.root.value).toBe('1000000');
  });

  it('未知 selector → unknown，且给出 unknown-selector finding', () => {
    const result = buildCallTree({ data: MALFORMED.unknownSelector + '00'.repeat(32) });
    expect(result.root.decodeStatus).toBe('unknown');
    expect(findingsOf(result.root, 'unknown-selector')).toHaveLength(1);
  });

  it('签名匹配但参数截断 → signature-only，不抛异常', () => {
    const result = buildCallTree({ data: MALFORMED.truncatedArgs });
    expect(result.root.decodeStatus).toBe('signature-only');
    expect(result.root.selector).toBe('0x095ea7b3');
  });

  it('注入的歧义签名解不出参数时降级为 signature-only', () => {
    const data = '0xdeadbeef00000000';
    const result = buildCallTree({ data }, {
      signatures: { '0xdeadbeef': 'approve(address,uint256)' },
    });
    expect(result.root.decodeStatus).toBe('signature-only');
    expect(result.root.signature).toBe('approve(address,uint256)');
  });
});

describe('buildCallTree: 输入边界', () => {
  it.each([
    ['奇数长度 hex', MALFORMED.oddLengthHex],
    ['非 hex 字符', MALFORMED.notHex],
    ['selector 截断', MALFORMED.tooShort],
  ])('%s → malformed 且不抛异常', (_name, data) => {
    const result = buildCallTree({ data });
    expect(result.root.decodeStatus).toBe('malformed');
    expect(result.root.children).toHaveLength(0);
  });

  it('空 calldata 视为纯转账而非错误', () => {
    const result = buildCallTree({ to: ADDR.recipient, data: '0x' });
    expect(result.root.decodeStatus).toBe('decoded');
    expect(result.root.selector).toBeNull();
  });

  it('超过 maxInputBytes → recursion-stopped + max-input-bytes', () => {
    const big = encodeAggregate3(
      Array.from({ length: 20 }, () => ({
        target: ADDR.usdc,
        allowFailure: false,
        callData: encodeApprove(),
      })),
    );
    const result = buildCallTree({ to: ADDR.multicall3, data: big }, { limits: { maxInputBytes: 32 } });
    expect(result.root.decodeStatus).toBe('recursion-stopped');
    expect(result.root.stopReason).toBe('max-input-bytes');
    expect(result.root.warnings.map((w) => w.code)).toContain('max-input-bytes-exceeded');
  });
});

describe('buildCallTree: Multicall3', () => {
  it('aggregate3：展示每个子调用并递归解析嵌套 approve', () => {
    const data = encodeAggregate3([
      { target: ADDR.usdc, allowFailure: false, callData: encodeApprove(ADDR.spender, MAX_UINT256) },
      { target: ADDR.usdc, allowFailure: true, callData: encodeTransfer(ADDR.recipient, 1n) },
    ]);
    const result = buildCallTree({ to: ADDR.multicall3, data });

    expect(result.root.decodeStatus).toBe('decoded');
    expect(result.root.container?.kind).toBe('multicall3-aggregate3');
    // 官方地址 + ABI 匹配
    expect(result.root.container?.identification).toBe('canonical-address-and-abi');
    expect(result.root.children).toHaveLength(2);
    expect(result.nodeCount).toBe(3);

    const [first, second] = result.root.children;
    expect(first.functionName).toBe('approve');
    expect(first.decodeStatus).toBe('decoded');
    expect(second.allowFailure).toBe(true);

    // 数组参数以计数展示，避免超长输出
    expect(result.root.params).toEqual([
      expect.objectContaining({ name: 'callsCount', value: '2' }),
    ]);
  });

  it('aggregate3 目标不是官方地址时说明识别依据', () => {
    const data = encodeAggregate3([
      { target: ADDR.usdc, allowFailure: false, callData: encodeApprove() },
    ]);
    const result = buildCallTree({ to: ADDR.otherMulticall, data });
    expect(result.root.container?.identification).toBe('selector-and-abi-shape');
    expect(result.root.container?.note).toBe('canonical-address-mismatch');
  });

  it('aggregate3Value：value 正确传播到子节点', () => {
    const data = encodeAggregate3Value([
      { target: ADDR.spender, allowFailure: false, value: 1_500_000n, callData: encodeTransfer(ADDR.recipient, 1n) },
    ]);
    const result = buildCallTree({ to: ADDR.multicall3, data });
    expect(result.root.container?.kind).toBe('multicall3-aggregate3Value');
    expect(result.root.children[0].value).toBe('1500000');
    expect(findingsOf(result.root, 'nonzero-native-value').length).toBeGreaterThanOrEqual(1);
  });

  it('multicall(bytes[])：子调用目标为容器自身地址并说明语义不确定性', () => {
    const data = encodeMulticallBytes([encodeApprove(), encodeTransfer(ADDR.recipient, 1n)]);
    const result = buildCallTree({ to: ADDR.otherMulticall, data });

    expect(result.root.container?.kind).toBe('multicall-bytes');
    expect(result.root.container?.note).toBe('multicall-bytes-shared');
    expect(result.root.children).toHaveLength(2);
    expect(result.root.children.every((child) => child.target === ADDR.otherMulticall.toLowerCase())).toBe(true);
    expect(result.root.children[0].functionName).toBe('approve');
  });

  it('空 batch：decoded、无子节点、无崩溃', () => {
    for (const data of [EMPTY_AGGREGATE3, EMPTY_EXECUTE_BATCH]) {
      const result = buildCallTree({ to: ADDR.multicall3, data });
      expect(result.root.decodeStatus).toBe('decoded');
      expect(result.root.children).toHaveLength(0);
    }
  });

  it('部分子调用未知时其余子调用继续解析', () => {
    const data = encodeAggregate3([
      { target: ADDR.usdc, allowFailure: false, callData: encodeApprove() },
      { target: ADDR.usdc, allowFailure: false, callData: ('0xdeadbeef' + '00'.repeat(32)) as `0x${string}` },
      { target: ADDR.usdc, allowFailure: false, callData: encodeTransfer(ADDR.recipient, 1n) },
    ]);
    const result = buildCallTree({ to: ADDR.multicall3, data });

    expect(result.root.children).toHaveLength(3);
    expect(result.root.children[0].functionName).toBe('approve');
    expect(result.root.children[1].decodeStatus).toBe('unknown');
    expect(result.root.children[2].functionName).toBe('transfer');
    // 容器自身解码成功，未知子调用不应使容器标记为 malformed
    expect(result.root.decodeStatus).toBe('decoded');
  });

  it('单个子节点解码失败 → 容器标记 partial 并保留其余节点', () => {
    const data = encodeAggregate3([
      { target: ADDR.usdc, allowFailure: false, callData: encodeApprove() },
      { target: ADDR.usdc, allowFailure: false, callData: MALFORMED.tooShort },
      { target: ADDR.usdc, allowFailure: false, callData: encodeTransfer(ADDR.recipient, 1n) },
    ]);
    const result = buildCallTree({ to: ADDR.multicall3, data });

    expect(result.root.decodeStatus).toBe('partial');
    expect(result.root.warnings.map((w) => w.code)).toContain('child-decode-failed');
    expect(result.root.children[0].decodeStatus).toBe('decoded');
    expect(result.root.children[1].decodeStatus).toBe('malformed');
    expect(result.root.children[2].decodeStatus).toBe('decoded');
  });

  it('畸形 ABI offset：容器解码失败 → 不崩溃并按未知处理', () => {
    const result = buildCallTree({ to: ADDR.multicall3, data: MALFORMED.badOffset });
    expect(result.root.decodeStatus).toBe('unknown');
    expect(result.root.children).toHaveLength(0);
  });
});

describe('buildCallTree: Safe', () => {
  it('CALL（operation=0）：继续解析内部 data', () => {
    const data = encodeSafeExecTransaction({
      to: ADDR.usdc,
      value: 0n,
      data: encodeApprove(ADDR.spender, 500n),
      operation: 0,
    });
    const result = buildCallTree({ to: ADDR.safeProxy, data });

    expect(result.root.container?.kind).toBe('safe-execTransaction');
    // Safe 节点保留 to / value / data / operation 关键参数
    expect(result.root.params).toEqual([
      expect.objectContaining({ name: 'to', value: '0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48' }),
      expect.objectContaining({ name: 'value', value: '0' }),
      expect.objectContaining({ name: 'data' }),
      expect.objectContaining({ name: 'operation', value: '0' }),
    ]);
    expect(result.root.children).toHaveLength(1);
    const inner = result.root.children[0];
    expect(inner.functionName).toBe('approve');
    expect(inner.sourceKind).toBe('safe-inner-call');
    expect(findingsOf(result.root, 'safe-delegatecall')).toHaveLength(0);
  });

  it('DELEGATECALL（operation=1）：高风险 finding 并继续解析', () => {
    const data = encodeSafeExecTransaction({
      to: ADDR.account,
      data: encodeTransfer(ADDR.recipient, 1n),
      operation: 1,
    });
    const result = buildCallTree({ to: ADDR.safeProxy, data });

    const delegateFindings = findingsOf(result.root, 'safe-delegatecall');
    expect(delegateFindings).toHaveLength(1);
    expect(delegateFindings[0].severity).toBe('high');
    // finding 指向 Safe 节点自身（operation 参数所在位置）
    expect(delegateFindings[0].nodePath).toBe('root');
    // DELEGATECALL 仍然解析内部 data，保证可见性
    expect(result.root.children[0].functionName).toBe('transfer');
  });

  it('同名 selector 但形状不匹配时不误判为容器', () => {
    // execTransaction 需要 10 个参数；只给 selector + 1 个 word → 解码失败，
    // 且本地签名库未收录 → 未知（不臆测容器身份）。
    const result = buildCallTree({ data: '0x6a761202' + '00'.repeat(32) });
    expect(result.root.container).toBeNull();
    expect(result.root.decodeStatus).toBe('unknown');
  });

  it('bytes 参数（signatures）碰巧以合法 selector 开头时绝不递归', () => {
    const data = encodeSafeExecTransaction({
      to: ADDR.usdc,
      data: '0x',
      signatures: SAFE_SIGNATURES_LOOKS_LIKE_APPROVE,
    });
    const result = buildCallTree({ to: ADDR.safeProxy, data });

    // 唯一子节点来自 data='0x'（纯转账），不存在 approve 节点
    const all = collect(result.root);
    expect(all.some((node) => node.functionName === 'approve')).toBe(false);
    expect(result.root.children).toHaveLength(1);
    expect(result.root.children[0].selector).toBeNull();
  });
});

describe('buildCallTree: 智能账户 execute / executeBatch', () => {
  it('execute：展示内部调用 target/value/data', () => {
    const data = encodeAccountExecute(
      ADDR.usdc,
      1_000n,
      encodeApprove(ADDR.spender, 42n),
    );
    const result = buildCallTree({ to: ADDR.account, data });

    expect(result.root.container?.kind).toBe('account-execute');
    expect(result.root.children).toHaveLength(1);
    expect(result.root.children[0].target).toBe(ADDR.usdc.toLowerCase());
    expect(result.root.children[0].value).toBe('1000');
    expect(result.root.children[0].functionName).toBe('approve');
    expect(result.nodeCount).toBe(2);
  });

  it('executeBatch：每个 Call 一个子节点', () => {
    const data = encodeAccountExecuteBatch([
      { target: ADDR.usdc, value: 0n, data: encodeApprove() },
      { target: ADDR.spender, value: 777n, data: encodeTransfer(ADDR.recipient, 1n) },
      { target: ADDR.usdc, value: 0n, data: encodeTransferFrom(ADDR.recipient, ADDR.spender, 5n) },
    ]);
    const result = buildCallTree({ to: ADDR.account, data });

    expect(result.root.container?.kind).toBe('account-executeBatch');
    expect(result.root.children).toHaveLength(3);
    expect(result.root.children[1].value).toBe('777');
    expect(result.root.children[2].functionName).toBe('transferFrom');
  });
});

describe('buildCallTree: ERC-4337 EntryPoint', () => {
  const callData = encodeAccountExecute(
    ADDR.usdc,
    0n,
    encodeApprove(ADDR.spender, MAX_UINT256),
  );

  it('handleOps（PackedUserOperation，v0.8 地址）：完整展开 op 与 callData', () => {
    const data = encodeHandleOpsPacked([
      {
        sender: ADDR.account,
        nonce: 3n,
        callData,
        initCode: `0x${'aa'.repeat(20)}${'bb'.repeat(12)}` as `0x${string}`,
        paymasterAndData: `0x${'cc'.repeat(20)}${'dd'.repeat(10)}` as `0x${string}`,
      },
    ], ADDR.beneficiary);
    const result = buildCallTree({ to: ADDR.entrypointV08, data });

    expect(result.root.container?.kind).toBe('entrypoint-handleOps');
    expect(result.root.container?.identification).toBe('entrypoint-canonical-address-and-abi');
    expect(result.root.container?.version).toBe('v0.8');
    expect(result.root.params).toEqual([
      expect.objectContaining({ name: 'opsCount', value: '1' }),
      expect.objectContaining({ name: 'beneficiary' }),
    ]);

    const op = result.root.children[0];
    expect(op.functionName).toBe('UserOperation');
    expect(op.userOp?.version).toBe('v0.7+');
    expect(op.userOp?.factory).toBe(`0x${'aa'.repeat(20)}`);
    expect(op.userOp?.paymaster).toBe(`0x${'cc'.repeat(20)}`);

    // gas 字段从 bytes32 解包（verification 128 + call 128）
    const gasLimit = op.params.find((param) => param.name === 'callGasLimit');
    expect(gasLimit?.value).toBe(String(300_000n));
    const maxFee = op.params.find((param) => param.name === 'maxFeePerGas');
    expect(maxFee?.value).toBe(String(2_000_000_000n));

    // signature 只展示长度与摘要
    const signature = op.params.find((param) => param.name === 'signature');
    expect(signature?.value).toMatch(/^len=65, keccak256=0x[0-9a-f]{64}$/);

    // callData → execute → approve 三层展开
    const executeNode = op.children[0];
    expect(executeNode.functionName).toBe('execute');
    expect(executeNode.target).toBe(ADDR.account.toLowerCase());
    expect(executeNode.children[0].functionName).toBe('approve');
    expect(result.nodeCount).toBe(4);
  });

  it('handleOps（v0.6 布局）：按形状识别并保留 raw 字段', () => {
    const data = encodeHandleOpsLegacy([
      { sender: ADDR.account, callData: encodeTransfer(ADDR.recipient, 1n) },
    ]);
    const result = buildCallTree({ to: ADDR.entrypointV07, data });

    // v0.7 地址上出现 legacy 布局：识别依据应说明按 ABI 形状
    expect(result.root.container?.kind).toBe('entrypoint-handleOps-legacy');
    expect(result.root.children[0].userOp?.version).toBe('v0.6');
    const inner = result.root.children[0].children[0];
    expect(inner.functionName).toBe('transfer');
  });

  it('无法确定账户实现时保留 callData 原始数据', () => {
    const unknownCall = ('0xdeadbeef' + '00'.repeat(32)) as `0x${string}`;
    const data = encodeHandleOpsPacked([{ sender: ADDR.account, callData: unknownCall }]);
    const result = buildCallTree({ to: ADDR.entrypointV07, data });

    const inner = result.root.children[0].children[0];
    expect(inner.decodeStatus).toBe('unknown');
    expect(inner.rawData).toBe(unknownCall);
    expect(inner.rawPreview.length).toBeLessThanOrEqual(
      2 + 256 * 2 + 1, // 0x + 256 字节 hex + 截断符
    );
  });

  it('不递归 UserOperation 的 signature 字段', () => {
    const data = encodeHandleOpsPacked([
      { sender: ADDR.account, callData: encodeTransfer(ADDR.recipient, 1n), signature: encodeApprove() },
    ]);
    const result = buildCallTree({ to: ADDR.entrypointV07, data });
    const all = collect(result.root);
    expect(all.filter((node) => node.functionName === 'approve')).toHaveLength(0);
  });
});

describe('buildCallTree: 嵌套与递归限制', () => {
  it('一层 / 两层 / 五层嵌套均完整展开', () => {
    for (const depth of [1, 2, 5]) {
      const data = encodeNestedAggregate3(depth);
      const result = buildCallTree({ to: ADDR.multicall3, data });
      // depth 层容器 + 最内层 approve
      expect(result.nodeCount).toBe(depth + 1);
      const deepest = collect(result.root).at(-1);
      expect(deepest?.functionName).toBe('approve');
      expect(deepest?.depth).toBe(depth);
    }
  });

  it('超过最大深度：保留已解析节点并明确标记停止原因', () => {
    const data = encodeNestedAggregate3(7);
    const result = buildCallTree({ to: ADDR.multicall3, data });

    const stopped = collect(result.root).find(
      (node) => node.stopReason === 'max-depth',
    );
    expect(stopped).toBeDefined();
    expect(stopped?.decodeStatus).toBe('recursion-stopped');
    expect(stopped?.warnings.map((w) => w.code)).toContain('max-depth-reached');
    expect(result.nodeCount).toBeLessThanOrEqual(100);
    // 深度恰好为 5 的节点存在且未继续展开
    const depthFive = collect(result.root).filter((node) => node.depth === 5);
    expect(depthFive.length).toBeGreaterThan(0);
    expect(depthFive[0].children).toHaveLength(0);
  });

  it('超过最大节点数：截断 + truncated 标记 + 不超过上限', () => {
    const data = encodeHugeAggregate3(50);
    const result = buildCallTree(
      { to: ADDR.multicall3, data },
      { limits: { maxNodes: 10 } },
    );
    expect(result.nodeCount).toBe(10);
    expect(result.truncated).toBe(true);
    expect(result.root.decodeStatus).toBe('partial');
    expect(result.warnings.map((w) => w.code)).toContain('max-nodes-reached');
  });

  it('数组项数上限：超出 maxArrayItems 的部分不解析并明确提示', () => {
    // 120 个 approve 约 27KB（低于 maxInputBytes），maxArrayItems=64 生效
    const data = encodeHugeAggregate3(120);
    const result = buildCallTree({ to: ADDR.multicall3, data });
    expect(result.root.children.length).toBe(64); // maxArrayItems
    expect(result.nodeCount).toBeLessThanOrEqual(100);
    expect(result.root.decodeStatus).toBe('partial');
    expect(result.warnings.map((w) => w.code)).toContain('max-array-items-truncated');
  });

  it('rawPreview 有界：超大输入不会完整出现在展示字段', () => {
    const data = encodeNestedAggregate3(5);
    const result = buildCallTree({ to: ADDR.multicall3, data });
    for (const node of collect(result.root)) {
      expect(node.rawPreview.length).toBeLessThanOrEqual(2 + 256 * 2 + 1);
    }
  });
});

describe('buildCallTree: 稳定性与不变量', () => {
  it('同一输入重复解析结果一致（含 id / path）', () => {
    const data = encodeAggregate3([
      { target: ADDR.usdc, allowFailure: true, callData: encodeNestedAggregate3(2) },
      { target: ADDR.spender, allowFailure: false, callData: encodeSafeExecTransaction({ operation: 1 }) },
    ]);
    const first = buildCallTree({ to: ADDR.multicall3, data }, { nowMs: FIXED_NOW_MS });
    const second = buildCallTree({ to: ADDR.multicall3, data }, { nowMs: FIXED_NOW_MS });
    expect(JSON.stringify(first)).toBe(JSON.stringify(second));
  });

  it('不修改输入对象', () => {
    const input = {
      to: ADDR.multicall3,
      value: 1n,
      data: encodeAggregate3([{ target: ADDR.usdc, allowFailure: false, callData: encodeApprove() }]),
    };
    const snapshot = JSON.stringify(input, (_key, value: unknown) =>
      typeof value === 'bigint' ? `${value}n` : value,
    );
    buildCallTree(input);
    expect(JSON.stringify(input, (_key, value: unknown) =>
      typeof value === 'bigint' ? `${value}n` : value,
    )).toBe(snapshot);
  });

  it('id / path 稳定且前序遍历一致', () => {
    const data = encodeAggregate3([
      { target: ADDR.usdc, allowFailure: false, callData: encodeApprove() },
      { target: ADDR.usdc, allowFailure: false, callData: encodeApprove() },
    ]);
    const result = buildCallTree({ to: ADDR.multicall3, data });
    const all = collect(result.root);
    expect(all.map((node) => node.id)).toEqual(['n0', 'n1', 'n2']);
    expect(all.map((node) => node.path)).toEqual(['root', 'root.0', 'root.1']);
    expect(all.map((node) => node.depth)).toEqual([0, 1, 1]);
  });

  it('已知选择器表保持可用（既有能力不回归）', () => {
    const fixtures: Array<[string, () => string]> = [
      ['approve', () => encodeApprove()],
      ['setApprovalForAll', () => encodeSetApprovalForAll(true)],
      ['permit', () => encodePermit(NOW_SEC + 3600n)],
      ['transferFrom', () => encodeTransferFrom(ADDR.recipient, ADDR.spender, 1n)],
      ['increaseAllowance', () => encodeIncreaseAllowance(1n)],
      ['transfer', () => encodeTransfer(ADDR.recipient, 1n)],
    ];
    for (const [name, build] of fixtures) {
      const result = buildCallTree({ to: ADDR.usdc, data: build() });
      expect(result.root.functionName, name).toBe(name);
      expect(result.root.decodeStatus).toBe('decoded');
    }
  });
});

describe('subtreeHasHighRisk', () => {
  it('高风险路径可被定位（UI 默认展开用）', () => {
    const data = encodeAggregate3([
      { target: ADDR.usdc, allowFailure: false, callData: encodeTransfer(ADDR.recipient, 1n) },
      { target: ADDR.usdc, allowFailure: false, callData: encodeApprove(ADDR.spender, MAX_UINT256) },
    ]);
    const result = buildCallTree({ to: ADDR.multicall3, data }, { nowMs: FIXED_NOW_MS });
    expect(subtreeHasHighRisk(result.root)).toBe(true);
    expect(subtreeHasHighRisk(result.root.children[0])).toBe(false);
    expect(subtreeHasHighRisk(result.root.children[1])).toBe(true);
  });
});
