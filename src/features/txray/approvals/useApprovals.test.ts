import { describe, expect, it } from 'vitest';
import { parseApprovalIndexPayload } from './useApprovals';

const VALID_PAIR = {
  token: '0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48',
  spender: '0xE592427A0AEce92De3Edee1F18E0157C05861564',
};

describe('parseApprovalIndexPayload', () => {
  it('preserves explicit partial coverage from the indexer', () => {
    const result = parseApprovalIndexPayload({
      erc20: [VALID_PAIR],
      nft: [],
      permit2: [],
      coverage: {
        status: 'partial',
        truncatedSources: ['erc20'],
        maxRecordsPerSource: 10_000,
      },
    });

    expect(result.coverage.status).toBe('partial');
    expect(result.erc20).toHaveLength(1);
  });

  it('rejects malformed addresses instead of trusting API JSON', () => {
    expect(() =>
      parseApprovalIndexPayload({
        erc20: [{ token: 'not-an-address', spender: VALID_PAIR.spender }],
        nft: [],
        permit2: [],
        coverage: {
          status: 'complete',
          truncatedSources: [],
          maxRecordsPerSource: 10_000,
        },
      }),
    ).toThrow(/无效/);
  });

  it('surfaces stable API error messages', () => {
    expect(() =>
      parseApprovalIndexPayload({
        error: { code: 'RATE_LIMITED', message: '请求过于频繁，请稍后重试' },
      }),
    ).toThrow('请求过于频繁，请稍后重试');
  });
});
