import { describe, expect, it } from 'vitest';
import {
  ADDR,
  MAX_UINT256,
  encodeAccountExecute,
  encodeAccountExecuteBatch,
  encodeAggregate3,
  encodeAggregate3Value,
  encodeApprove,
  encodeHandleOpsPacked,
  encodeIncreaseAllowance,
  encodeMulticallBytes,
  encodeNestedAggregate3,
  encodePermit,
  encodePermit2PermitTransferFrom,
  encodeSafeExecTransaction,
  encodeSetApprovalForAll,
  encodeTransfer,
  encodeTransferFrom,
} from './fixtures';
import { buildCallTree } from './decode';
import type { CallNode, RiskCode } from './types';

// 固定参考时刻：2025-07-15T00:00:00Z，deadline 测试完全确定。
const NOW_MS = 1_752_537_600_000;
const NOW_SEC = BigInt(Math.floor(NOW_MS / 1000));

function collect(node: CallNode): CallNode[] {
  return [node, ...node.children.flatMap(collect)];
}

function codes(node: CallNode): RiskCode[] {
  return collect(node).flatMap((item) => item.riskFindings.map((f) => f.code));
}

function findByCode(node: CallNode, code: RiskCode) {
  return collect(node).flatMap((item) =>
    item.riskFindings
      .filter((finding) => finding.code === code)
      .map((finding) => ({ finding, node: item })),
  );
}

describe('风险规则：授权类', () => {
  it('erc20-max-allowance：approve(spender, MAX) → high', () => {
    const result = buildCallTree(
      { to: ADDR.usdc, data: encodeApprove(ADDR.spender, MAX_UINT256) },
      { nowMs: NOW_MS },
    );
    const hits = findByCode(result.root, 'erc20-max-allowance');
    expect(hits).toHaveLength(1);
    expect(hits[0].finding.severity).toBe('high');
    expect(hits[0].finding.evidence.spender).toBe(
      '0xE592427A0AEce92De3Edee1F18E0157C05861564',
    );
  });

  it('approve 非最大额度时不触发 max-allowance', () => {
    const result = buildCallTree(
      { to: ADDR.usdc, data: encodeApprove(ADDR.spender, 100n) },
      { nowMs: NOW_MS },
    );
    expect(codes(result.root)).not.toContain('erc20-max-allowance');
  });

  it('erc20-increase-allowance → medium', () => {
    const result = buildCallTree(
      { to: ADDR.usdc, data: encodeIncreaseAllowance(5n) },
      { nowMs: NOW_MS },
    );
    expect(findByCode(result.root, 'erc20-increase-allowance')).toHaveLength(1);
  });

  it('setApprovalForAll(true) → high；false 不触发', () => {
    const yes = buildCallTree(
      { to: ADDR.usdc, data: encodeSetApprovalForAll(true) },
      { nowMs: NOW_MS },
    );
    const hits = findByCode(yes.root, 'nft-approval-for-all');
    expect(hits).toHaveLength(1);
    expect(hits[0].finding.severity).toBe('high');

    const no = buildCallTree(
      { to: ADDR.usdc, data: encodeSetApprovalForAll(false) },
      { nowMs: NOW_MS },
    );
    expect(codes(no.root)).not.toContain('nft-approval-for-all');
  });

  it('transferFrom → medium', () => {
    const result = buildCallTree(
      { to: ADDR.usdc, data: encodeTransferFrom(ADDR.recipient, ADDR.spender, 1n) },
      { nowMs: NOW_MS },
    );
    expect(findByCode(result.root, 'transfer-from')).toHaveLength(1);
  });
});

describe('风险规则：permit / Permit2', () => {
  it('erc20-permit → high', () => {
    const result = buildCallTree(
      { to: ADDR.usdc, data: encodePermit(NOW_SEC + 3600n) },
      { nowMs: NOW_MS },
    );
    expect(findByCode(result.root, 'erc20-permit')).toHaveLength(1);
    // 1 小时后过期：既不过期也不极长
    expect(codes(result.root)).not.toContain('deadline-suspicious');
  });

  it('deadline 已过期 → deadline-suspicious (expired)', () => {
    const result = buildCallTree(
      { to: ADDR.usdc, data: encodePermit(NOW_SEC - 60n) },
      { nowMs: NOW_MS },
    );
    const hits = findByCode(result.root, 'deadline-suspicious');
    expect(hits).toHaveLength(1);
    expect(hits[0].finding.evidence.reason).toBe('expired');
  });

  it('deadline 极长（>30 天）→ deadline-suspicious (too-long)', () => {
    const result = buildCallTree(
      { to: ADDR.usdc, data: encodePermit(NOW_SEC + 60n * 60n * 24n * 365n) },
      { nowMs: NOW_MS },
    );
    const hits = findByCode(result.root, 'deadline-suspicious');
    expect(hits).toHaveLength(1);
    expect(hits[0].finding.evidence.reason).toBe('too-long');
  });

  it('permit2-permit：Permit2 地址 + 官方选择器 → high', () => {
    const result = buildCallTree(
      {
        to: ADDR.permit2,
        data: encodePermit2PermitTransferFrom(NOW_SEC + 3600n),
      },
      { nowMs: NOW_MS },
    );
    expect(findByCode(result.root, 'permit2-permit')).toHaveLength(1);
  });

  it('同一 permit 选择器但目标不是 Permit2 时不触发 permit2-permit', () => {
    const result = buildCallTree(
      {
        to: ADDR.usdc,
        data: encodePermit2PermitTransferFrom(NOW_SEC + 3600n),
      },
      { nowMs: NOW_MS },
    );
    expect(codes(result.root)).not.toContain('permit2-permit');
  });
});

describe('风险规则：容器与调用语义', () => {
  it('Safe DELEGATECALL → high（CALL 无此 finding）', () => {
    const delegate = buildCallTree(
      {
        to: ADDR.safeProxy,
        data: encodeSafeExecTransaction({ to: ADDR.usdc, operation: 1 }),
      },
      { nowMs: NOW_MS },
    );
    expect(findByCode(delegate.root, 'safe-delegatecall')).toHaveLength(1);

    const call = buildCallTree(
      {
        to: ADDR.safeProxy,
        data: encodeSafeExecTransaction({ to: ADDR.usdc, operation: 0 }),
      },
      { nowMs: NOW_MS },
    );
    expect(codes(call.root)).not.toContain('safe-delegatecall');
  });

  it('非零 native value → low（容器子调用也会检查）', () => {
    const result = buildCallTree(
      {
        to: ADDR.multicall3,
        data: encodeAggregate3Value([
          { target: ADDR.spender, allowFailure: false, value: 1n, callData: encodeTransfer(ADDR.recipient, 1n) },
        ]),
      },
      { nowMs: NOW_MS },
    );
    const hits = findByCode(result.root, 'nonzero-native-value');
    expect(hits.map((hit) => hit.node.path)).toContain('root.0');
  });

  it('batch-contains-high-risk：批量中混入高风险授权 → 容器 high', () => {
    const result = buildCallTree(
      {
        to: ADDR.multicall3,
        data: encodeAggregate3([
          { target: ADDR.usdc, allowFailure: false, callData: encodeTransfer(ADDR.recipient, 1n) },
          { target: ADDR.usdc, allowFailure: false, callData: encodeApprove(ADDR.spender, MAX_UINT256) },
        ]),
      },
      { nowMs: NOW_MS },
    );
    const hits = findByCode(result.root, 'batch-contains-high-risk');
    expect(hits).toHaveLength(1);
    expect(hits[0].finding.severity).toBe('high');
    expect(hits[0].finding.evidence.highRiskPaths).toBe('root.1');
  });

  it('batch 无高风险时不触发 batch-contains-high-risk', () => {
    const result = buildCallTree(
      {
        to: ADDR.multicall3,
        data: encodeAggregate3([
          { target: ADDR.usdc, allowFailure: false, callData: encodeTransfer(ADDR.recipient, 1n) },
        ]),
      },
      { nowMs: NOW_MS },
    );
    expect(codes(result.root)).not.toContain('batch-contains-high-risk');
  });

  it('subcall-allow-failure：allowFailure=true → low', () => {
    const result = buildCallTree(
      {
        to: ADDR.multicall3,
        data: encodeAggregate3([
          { target: ADDR.usdc, allowFailure: true, callData: encodeTransfer(ADDR.recipient, 1n) },
        ]),
      },
      { nowMs: NOW_MS },
    );
    const hits = findByCode(result.root, 'subcall-allow-failure');
    expect(hits).toHaveLength(1);
    expect(hits[0].node.path).toBe('root.0');
  });

  it('multicall(bytes[]) 嵌套 approve 也会被批量聚合发现', () => {
    const result = buildCallTree(
      {
        to: ADDR.otherMulticall,
        data: encodeMulticallBytes([encodeApprove(ADDR.spender, MAX_UINT256)]),
      },
      { nowMs: NOW_MS },
    );
    expect(findByCode(result.root, 'batch-contains-high-risk')).toHaveLength(1);
    expect(findByCode(result.root, 'erc20-max-allowance')).toHaveLength(1);
  });
});

describe('风险规则：解析状态与未知', () => {
  it('unknown-selector → info', () => {
    const result = buildCallTree(
      { data: '0xdeadbeef' + '00'.repeat(32) },
      { nowMs: NOW_MS },
    );
    const hits = findByCode(result.root, 'unknown-selector');
    expect(hits).toHaveLength(1);
    expect(hits[0].finding.severity).toBe('info');
  });

  it('signature-only → parse-incomplete (medium)', () => {
    const result = buildCallTree(
      { data: '0x095ea7b3' + '00'.repeat(16) },
      { nowMs: NOW_MS },
    );
    expect(findByCode(result.root, 'parse-incomplete')).toHaveLength(1);
  });

  it('unknown-target → info（无法给出目标地址时）', () => {
    const result = buildCallTree(
      { data: encodeMulticallBytes([encodeApprove()]) },
      { nowMs: NOW_MS },
    );
    // 容器与子调用均无 target
    const hits = findByCode(result.root, 'unknown-target');
    expect(hits.length).toBeGreaterThanOrEqual(2);
    expect(hits.every((hit) => hit.finding.severity === 'info')).toBe(true);
  });

  it('depth-limit-reached / node-limit-reached 对应停止原因', () => {
    const depth = buildCallTree(
      { to: ADDR.multicall3, data: encodeNestedAggregate3(7) },
      { nowMs: NOW_MS },
    );
    expect(findByCode(depth.root, 'depth-limit-reached')).toHaveLength(1);

    const nodes = buildCallTree(
      { to: ADDR.multicall3, data: encodeAggregate3([
        { target: ADDR.usdc, allowFailure: false, callData: encodeApprove() },
        { target: ADDR.usdc, allowFailure: false, callData: encodeApprove() },
      ]) },
      { nowMs: NOW_MS, limits: { maxNodes: 2 } },
    );
    expect(findByCode(nodes.root, 'node-limit-reached')).toHaveLength(1);
  });
});

describe('风险规则：ERC-4337', () => {
  it('factory 存在 → userop-factory (medium)', () => {
    const result = buildCallTree(
      {
        to: ADDR.entrypointV07,
        data: encodeHandleOpsPacked([
          {
            sender: ADDR.account,
            callData: encodeAccountExecute(ADDR.usdc, 0n, encodeApprove()),
            initCode: `0x${'aa'.repeat(20)}${'bb'.repeat(12)}` as `0x${string}`,
          },
        ]),
      },
      { nowMs: NOW_MS },
    );
    const hits = findByCode(result.root, 'userop-factory');
    expect(hits).toHaveLength(1);
    expect(hits[0].finding.evidence.factory).toBe(`0x${'aa'.repeat(20)}`);
  });

  it('paymaster 存在 → userop-paymaster (info)', () => {
    const result = buildCallTree(
      {
        to: ADDR.entrypointV07,
        data: encodeHandleOpsPacked([
          {
            sender: ADDR.account,
            callData: encodeTransfer(ADDR.recipient, 1n),
            paymasterAndData: `0x${'cc'.repeat(20)}${'dd'.repeat(10)}` as `0x${string}`,
          },
        ]),
      },
      { nowMs: NOW_MS },
    );
    const hits = findByCode(result.root, 'userop-paymaster');
    expect(hits).toHaveLength(1);
    expect(hits[0].finding.severity).toBe('info');
  });

  it('无 factory / paymaster 时不触发对应 finding', () => {
    const result = buildCallTree(
      {
        to: ADDR.entrypointV07,
        data: encodeHandleOpsPacked([
          { sender: ADDR.account, callData: encodeTransfer(ADDR.recipient, 1n) },
        ]),
      },
      { nowMs: NOW_MS },
    );
    expect(codes(result.root)).not.toContain('userop-factory');
    expect(codes(result.root)).not.toContain('userop-paymaster');
  });
});

describe('风险规则：通用约束', () => {
  it('所有 finding 都指向有效 nodePath 且 evidence 为字符串', () => {
    const result = buildCallTree(
      {
        to: ADDR.multicall3,
        value: 5n,
        data: encodeAccountExecuteBatch([
          { target: ADDR.usdc, value: 0n, data: encodeApprove(ADDR.spender, MAX_UINT256) },
          { target: ADDR.usdc, value: 0n, data: encodeSafeExecTransaction({ operation: 1 }) },
        ]),
      },
      { nowMs: NOW_MS },
    );
    const all = collect(result.root).flatMap((node) => node.riskFindings);
    expect(all.length).toBeGreaterThan(0);
    for (const item of all) {
      expect(item.nodePath).toMatch(/^root(\.\d+)*$/);
      for (const value of Object.values(item.evidence)) {
        expect(typeof value).toBe('string');
      }
    }
  });

  it('execute 携带 value → nonzero-native-value 指向内部调用节点', () => {
    const result = buildCallTree(
      {
        to: ADDR.account,
        data: encodeAccountExecute(ADDR.spender, 10n, encodeTransfer(ADDR.recipient, 1n)),
      },
      { nowMs: NOW_MS },
    );
    const hits = findByCode(result.root, 'nonzero-native-value');
    // value 出现在 execute 展开出的内部调用（transfer）节点上
    expect(hits.map((hit) => hit.node.path)).toEqual(['root.0']);
  });
});
