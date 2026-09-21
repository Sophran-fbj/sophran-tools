import { describe, expect, it, vi } from 'vitest';
import type { PublicClient } from 'viem';
import { decodeInput, isMaxUintValue } from './useDecoder';

const APPROVE_MAX =
  '0x095ea7b3000000000000000000000000e592427a0aece92de3edee1f18e0157c05861564ffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffff';

describe('decodeInput', () => {
  it('decodes known calldata locally without a network lookup', async () => {
    const lookup = vi.fn();
    const result = await decodeInput(undefined, APPROVE_MAX, lookup);

    expect(result.functionName).toBe('approve');
    expect(result.params).toHaveLength(2);
    expect(result.params[0].value.toLowerCase()).toBe(
      '0xe592427a0aece92de3edee1f18e0157c05861564',
    );
    expect(result.danger).toBe('high');
    expect(lookup).not.toHaveBeenCalled();
  });

  it('rejects malformed calldata', async () => {
    await expect(decodeInput(undefined, '0x1234')).rejects.toThrow(
      '不是有效的 calldata',
    );
  });

  it('resolves tx hash input and carries the transaction value', async () => {
    const lookup = vi.fn();
    const client = {
      getTransaction: vi.fn().mockResolvedValue({
        input: APPROVE_MAX,
        to: '0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48',
        value: 123n,
      }),
    } as unknown as PublicClient;

    const hash =
      '0x1111111111111111111111111111111111111111111111111111111111111111';
    const result = await decodeInput(client, hash, lookup);

    expect(result.source).toBe('tx');
    expect(result.functionName).toBe('approve');
    expect(result.to).toBe('0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48');
    expect(result.txValue).toBe(123n);
    expect(client.getTransaction).toHaveBeenCalledWith({ hash });
  });

  it('rejects plain transfers without calldata', async () => {
    const client = {
      getTransaction: vi.fn().mockResolvedValue({ input: '0x', to: null }),
    } as unknown as PublicClient;
    const hash =
      '0x2222222222222222222222222222222222222222222222222222222222222222';
    await expect(decodeInput(client, hash, vi.fn())).rejects.toThrow(
      '普通转账',
    );
  });
});

describe('isMaxUintValue', () => {
  it('supports declared integer widths', () => {
    expect(isMaxUintValue('uint160', (2n ** 160n - 1n).toString())).toBe(true);
    expect(isMaxUintValue('uint256', (2n ** 256n - 1n).toString())).toBe(true);
    expect(isMaxUintValue('uint160', (2n ** 256n - 1n).toString())).toBe(false);
  });
});
