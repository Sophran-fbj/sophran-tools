import { describe, expect, it, vi } from 'vitest';
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
});

describe('isMaxUintValue', () => {
  it('supports declared integer widths', () => {
    expect(isMaxUintValue('uint160', (2n ** 160n - 1n).toString())).toBe(true);
    expect(isMaxUintValue('uint256', (2n ** 256n - 1n).toString())).toBe(true);
    expect(isMaxUintValue('uint160', (2n ** 256n - 1n).toString())).toBe(false);
  });
});
