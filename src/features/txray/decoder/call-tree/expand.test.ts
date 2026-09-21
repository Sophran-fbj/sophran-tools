import { describe, expect, it } from 'vitest';
import {
  ADDR,
  encodeAggregate3,
  encodeApprove,
  encodeTransfer,
} from './fixtures';
import { buildCallTree } from './decode';
import { collectDefaultExpandedPaths, inspectSubtree } from './expand';

// 回归测试：未知 / 仅签名 / 部分解析 / 畸形 子节点必须沿祖先链
// 默认展开（"unknown 不等于 safe"），不能被折叠隐藏。

const USDC = ADDR.usdc;

describe('collectDefaultExpandedPaths', () => {
  it('未知子调用沿祖先链默认展开（正常兄弟节点不受影响）', () => {
    const data = encodeAggregate3([
      { target: USDC, allowFailure: false, callData: encodeTransfer(ADDR.recipient, 1n) },
      { target: USDC, allowFailure: false, callData: ('0xdeadbeef' + '00'.repeat(32)) as `0x${string}` },
    ]);
    const result = buildCallTree({ to: USDC, data });
    const expanded = collectDefaultExpandedPaths(result.root);

    expect(expanded.has('root')).toBe(true);
    expect(expanded.has('root.1')).toBe(true);
    // 正常子调用不参与展开集合（它本身总是可见的，无需展开）
    expect(expanded.has('root.0')).toBe(false);
  });

  it('仅签名状态的子调用同样默认展开', () => {
    const data = encodeAggregate3([
      { target: USDC, allowFailure: false, callData: ('0x095ea7b3' + '00'.repeat(16)) as `0x${string}` },
    ]);
    const result = buildCallTree({ to: USDC, data });
    const expanded = collectDefaultExpandedPaths(result.root);
    expect(expanded.has('root.0')).toBe(true);
  });

  it('无任何问题的树只默认展开根节点', () => {
    const data = encodeAggregate3([
      { target: USDC, allowFailure: false, callData: encodeTransfer(ADDR.recipient, 1n) },
      { target: USDC, allowFailure: false, callData: encodeTransfer(ADDR.recipient, 2n) },
    ]);
    const result = buildCallTree({ to: USDC, data });
    const expanded = collectDefaultExpandedPaths(result.root);
    expect([...expanded]).toEqual(['root']);
  });

  it('深层嵌套中的未知调用会展开整条祖先链', () => {
    const inner = encodeAggregate3([
      { target: USDC, allowFailure: false, callData: encodeApprove() },
      { target: USDC, allowFailure: false, callData: ('0xdeadbeef' + '00'.repeat(32)) as `0x${string}` },
    ]);
    const outer = encodeAggregate3([
      { target: USDC, allowFailure: false, callData: inner },
    ]);
    const result = buildCallTree({ to: USDC, data: outer });
    const expanded = collectDefaultExpandedPaths(result.root);

    expect(expanded.has('root')).toBe(true);
    expect(expanded.has('root.0')).toBe(true);
    expect(expanded.has('root.0.1')).toBe(true);
  });
});

describe('inspectSubtree', () => {
  it('容器汇总子树内未知/不完整节点数', () => {
    const data = encodeAggregate3([
      { target: USDC, allowFailure: false, callData: encodeTransfer(ADDR.recipient, 1n) },
      { target: USDC, allowFailure: false, callData: ('0xdeadbeef' + '00'.repeat(32)) as `0x${string}` },
    ]);
    const result = buildCallTree({ to: USDC, data });
    const issues = inspectSubtree(result.root);
    expect(issues.incomplete).toBe(1);
    expect(issues.highRisk).toBe(false);

    const childIssues = inspectSubtree(result.root.children[1]);
    expect(childIssues.incomplete).toBe(1);
  });
});
