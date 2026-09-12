import { describe, expect, it } from 'vitest';
import { parseTokenPrices } from './useTokenPrices';

describe('parseTokenPrices', () => {
  it('accepts only finite non-negative USD prices', () => {
    expect(
      parseTokenPrices({
        '0xABC': { usd: 1.25 },
        negative: { usd: -1 },
        infinite: { usd: Number.POSITIVE_INFINITY },
        malformed: '1',
      }),
    ).toEqual({ '0xabc': 1.25 });
  });
});
