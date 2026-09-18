import { describe, expect, it } from 'vitest';
import {
  ADDR,
  encodeAccountExecute,
  encodeAccountExecuteBatch,
  encodeAggregate3,
  encodeApprove,
  encodeMulticallBytes,
  encodeSafeExecTransaction,
  encodeTransfer,
  type Call3,
} from './fixtures';
import { buildCallTree } from './decode';
import type { CallNode } from './types';

// Property / fuzz 风格测试（离线、可重复、固定种子）。
// 保证：任意输入 —— 不无限递归、不超节点上限、不抛未捕获异常、
// BigInt 不经不安全 Number 转换（输出中的数值全部是字符串）、输出稳定、不修改输入。

/** mulberry32：确定性 PRNG（固定种子，测试可重复）。 */
function createRandom(seed: number): () => number {
  let state = seed >>> 0;
  return () => {
    state = (state + 0x6d2b79f5) | 0;
    let t = Math.imul(state ^ (state >>> 15), 1 | state);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const random = createRandom(20260919);

function randomHexBytes(minBytes: number, maxBytes: number): `0x${string}` {
  const count = minBytes + Math.floor(random() * (maxBytes - minBytes + 1));
  let hex = '0x';
  for (let index = 0; index < count; index += 1) {
    hex += Math.floor(random() * 256).toString(16).padStart(2, '0');
  }
  return hex as `0x${string}`;
}

function randomAddress(): `0x${string}` {
  return randomHexBytes(20, 20) as `0x${string}`;
}

/** 随机生成一段「可能合法也可能畸形」的 calldata。 */
function arbitraryInput(index: number): { to: string | null; value: bigint | null; data: string } {
  const variant = index % 10;
  switch (variant) {
    case 0:
      return { to: randomAddress(), value: null, data: randomHexBytes(0, 2048) };
    case 1:
      return { to: null, value: null, data: `0x${Math.floor(random() * 0xffffffff).toString(16).padStart(8, '0')}` };
    case 2:
      // selector + 随机 body（大概率无法解码）
      return { to: ADDR.usdc, value: null, data: randomHexBytes(64, 512) };
    case 3:
      return { to: ADDR.multicall3, value: 1n, data: encodeApprove(randomAddress()) };
    case 4: {
      // aggregate3 混合合法 / 畸形子调用
      const calls: Call3[] = Array.from({ length: 1 + Math.floor(random() * 6) }, () => ({
        target: randomAddress(),
        allowFailure: random() > 0.5,
        callData: random() > 0.5 ? encodeApprove(randomAddress(), 1n) : randomHexBytes(0, 96),
      }));
      return { to: ADDR.multicall3, value: null, data: encodeAggregate3(calls) };
    }
    case 5:
      return {
        to: ADDR.safeProxy,
        value: null,
        data: encodeSafeExecTransaction({
          to: randomAddress(),
          data: random() > 0.5 ? encodeTransfer(randomAddress(), 1n) : randomHexBytes(0, 64),
          operation: Math.floor(random() * 3),
        }),
      };
    case 6:
      return {
        to: ADDR.account,
        value: null,
        data: encodeAccountExecute(randomAddress(), BigInt(Math.floor(random() * 1000)), encodeApprove()),
      };
    case 7:
      return {
        to: ADDR.account,
        value: null,
        data: encodeAccountExecuteBatch(
          Array.from({ length: 1 + Math.floor(random() * 5) }, () => ({
            target: randomAddress(),
            value: 0n,
            data: random() > 0.5 ? encodeApprove() : randomHexBytes(0, 32),
          })),
        ),
      };
    case 8:
      return { to: null, value: null, data: encodeMulticallBytes([encodeApprove(), randomHexBytes(0, 48)]) };
    default:
      // 奇数长度 / 非 hex / 超短
      const pick = random();
      if (pick < 0.33) return { to: null, value: null, data: `0x${'a'.repeat(1 + Math.floor(random() * 64))}` };
      if (pick < 0.66) return { to: null, value: null, data: randomHexBytes(0, 32).replace(/f/g, 'g') };
      return { to: null, value: null, data: '0x' };
  }
}

const MAX_NODES = 100;
const MAX_DEPTH = 5;

function walk(node: CallNode, visit: (node: CallNode) => void): void {
  visit(node);
  node.children.forEach((child) => walk(child, visit));
}

describe('property: 任意输入下的不变量', () => {
  const rounds = 400;

  it(`不抛未捕获异常 / 不超节点与深度上限 / 输出稳定（${rounds} 轮）`, () => {
    const inputs = Array.from({ length: rounds }, (_, index) => arbitraryInput(index));
    const outputs = inputs.map((input) => buildCallTree(input, { nowMs: 0 }));

    outputs.forEach((result) => {
      expect(result.nodeCount).toBeLessThanOrEqual(MAX_NODES);
      let maxDepth = 0;
      let nodeTotal = 0;
      walk(result.root, (node) => {
        maxDepth = Math.max(maxDepth, node.depth);
        nodeTotal += 1;
      });
      expect(maxDepth).toBeLessThanOrEqual(MAX_DEPTH);
      expect(nodeTotal).toBe(result.nodeCount);
      // 递归停止的节点不携带子节点
      walk(result.root, (node) => {
        if (node.stopReason === 'max-depth') {
          expect(node.children).toHaveLength(0);
        }
      });
    });

    // 同一输入重复解析：输出完全一致
    inputs.forEach((input, index) => {
      const replay = buildCallTree(input, { nowMs: 0 });
      expect(JSON.stringify(replay), `round ${index}`).toBe(JSON.stringify(outputs[index]));
    });
  });

  it('BigInt 永不经过不安全的 Number 转换（数值字段全部为十进制字符串）', () => {
    for (let index = 0; index < rounds; index += 1) {
      const input = arbitraryInput(index);
      const result = buildCallTree(input, { nowMs: 0 });
      walk(result.root, (node) => {
        if (node.value !== null) {
          expect(node.value, `round ${index} ${node.path}`).toMatch(/^\d+$/);
          expect(Number.isSafeInteger(Number(node.value)) || node.value.length > 15).toBe(true);
        }
        for (const param of node.params) {
          if (/^u?int/.test(param.type)) {
            expect(param.value, `round ${index} ${node.path} ${param.name}`).toMatch(/^\d+$/);
          }
        }
      });
    }
  });

  it('不修改输入对象', () => {
    const replacer = (_key: string, value: unknown): unknown =>
      typeof value === 'bigint' ? `${value}n` : value;
    for (let index = 0; index < rounds; index += 1) {
      const input = arbitraryInput(index);
      const before = JSON.stringify(input, replacer);
      buildCallTree(input, { nowMs: 0 });
      expect(JSON.stringify(input, replacer), `round ${index}`).toBe(before);
    }
  });

  it('raw data / rawPreview 不超过输入上限（无资源放大）', () => {
    for (let index = 0; index < rounds; index += 1) {
      const input = arbitraryInput(index);
      const result = buildCallTree(input, { nowMs: 0 });
      walk(result.root, (node) => {
        expect(node.rawData.length).toBeLessThanOrEqual(
          Math.max(input.data.length, 2 + 32 * 1024 * 2),
        );
        expect(node.rawPreview.length).toBeLessThanOrEqual(2 + 256 * 2 + 1);
      });
    }
  });
});
