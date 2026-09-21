import { describe, expect, it } from 'vitest';
import {
  ADDR,
  MAX_UINT256,
  encodeAccountExecute,
  encodeAggregate3,
  encodeApprove,
  encodeHandleOpsPacked,
  encodeMulticallBytes,
  encodeSafeExecTransaction,
} from './fixtures';
import { buildCallTree } from './decode';

// 可重复性能基准：解析耗时只做宽松上界断言（防止性能意外回归），
// 实测数值记录在 docs/call-tree/report.md，不作为硬性断言。

function now(): number {
  return performance.now();
}

function measure(label: string, data: string, iterations = 50): number {
  // 预热一次，避免首次 JIT 影响计时
  buildCallTree({ to: ADDR.multicall3, data });
  const start = now();
  for (let index = 0; index < iterations; index += 1) {
    buildCallTree({ to: ADDR.multicall3, data });
  }
  const perCall = (now() - start) / iterations;
  console.log(`[perf-call-tree] ${label}: ${perCall.toFixed(3)} ms/次`);
  return perCall;
}

function buildAggregate3WithSubcalls(count: number): string {
  return encodeAggregate3(
    Array.from({ length: count }, (_, index) => ({
      target: ADDR.usdc,
      allowFailure: false,
      callData: encodeApprove(ADDR.spender, BigInt(index + 1)),
    })),
  );
}

describe('call-tree 解析性能（宽松上界）', () => {
  it('10 个节点（约 9 子调用的 aggregate3）', () => {
    const elapsed = measure('10 nodes', buildAggregate3WithSubcalls(9));
    expect(elapsed).toBeLessThan(50);
  });

  it('50 个节点（约 49 子调用的 aggregate3）', () => {
    const elapsed = measure('50 nodes', buildAggregate3WithSubcalls(49));
    expect(elapsed).toBeLessThan(50);
  });

  it('100 个节点上限（64 子调用数组封顶 + 嵌套）', () => {
    // 每个 slot 再嵌套一层 multicall，把节点推向 100 上限
    const data = encodeAggregate3(
      Array.from({ length: 16 }, () => ({
        target: ADDR.multicall3,
        allowFailure: false,
        callData: encodeMulticallBytes(
          Array.from({ length: 4 }, () => encodeApprove()),
        ),
      })),
    );
    const result = buildCallTree({ to: ADDR.multicall3, data });
    expect(result.nodeCount).toBeLessThanOrEqual(100);
    const elapsed = measure('100-node cap', data);
    expect(elapsed).toBeLessThan(50);
  });

  it('深度 5 嵌套', () => {
    let inner: `0x${string}` = encodeApprove();
    for (let level = 0; level < 5; level += 1) {
      inner = encodeAggregate3([
        { target: ADDR.multicall3, allowFailure: false, callData: inner },
      ]);
    }
    const elapsed = measure('depth 5', inner);
    expect(elapsed).toBeLessThan(50);
  });

  it('大型 raw input（约 31KB）', () => {
    const data = buildAggregate3WithSubcalls(135);
    expect(data.length).toBeGreaterThan(50_000); // ~25KB+ hex 字符
    const elapsed = measure('large input', data, 20);
    expect(elapsed).toBeLessThan(80);
  });

  it('畸形输入（大量随机 hex）', () => {
    let seed = 42;
    let blob = '0x';
    for (let index = 0; index < 16_000; index += 1) {
      seed = (seed * 1103515245 + 12345) % 2147483648;
      blob += (seed % 16).toString(16);
    }
    const elapsed = measure('malformed 8KB', blob, 50);
    expect(elapsed).toBeLessThan(50);
  });

  it('真实场景组合：Safe 委托调用 + EntryPoint handleOps', () => {
    const safe = encodeSafeExecTransaction({
      to: ADDR.multicall3,
      operation: 1,
      data: encodeAggregate3(
        Array.from({ length: 20 }, () => ({
          target: ADDR.usdc,
          allowFailure: true,
          callData: encodeApprove(),
        })),
      ),
    });
    const entrypoint = encodeHandleOpsPacked(
      Array.from({ length: 3 }, () => ({
        sender: ADDR.account,
        callData: encodeAccountExecute(ADDR.usdc, 0n, encodeApprove()),
      })),
    );
    const safeElapsed = measure('safe delegatecall batch', safe);
    const entrypointElapsed = measure('entrypoint handleOps', entrypoint);
    expect(safeElapsed).toBeLessThan(50);
    expect(entrypointElapsed).toBeLessThan(50);
  });

  it('MAX_UINT256 金额不会被精度损失（BigInt 通路抽查）', () => {
    const result = buildCallTree({ to: ADDR.usdc, data: encodeApprove(ADDR.spender, MAX_UINT256) });
    expect(result.root.params[1].value).toBe(
      '115792089237316195423570985008687907853269984665640564039457584007913129639935',
    );
  });
});
