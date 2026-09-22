import { describe, expect, it } from 'vitest';
import {
  fetchTokenPriceCoverage,
  parseTokenPrices,
} from './useTokenPrices';
import { parseTokenPriceApiPayload } from './tokenPrices';

describe('parseTokenPrices', () => {
  it('accepts only finite non-negative USD prices', () => {
    expect(
      parseTokenPrices({
        '0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48': { usd: 1.25 },
        negative: { usd: -1 },
        infinite: { usd: Number.POSITIVE_INFINITY },
        malformed: '1',
      }),
    ).toEqual({ '0xa0b86991c6218b36c1d19d4a2e9eb0ce3606eb48': 1.25 });
  });
});

describe('parseTokenPriceApiPayload', () => {
  it('keeps explicit coverage and rejects malformed prices', () => {
    expect(
      parseTokenPriceApiPayload({
        prices: {
          '0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48': 1,
        },
        coverage: {
          status: 'partial',
          missing: ['0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2'],
        },
      }),
    ).toEqual({
      prices: { '0xa0b86991c6218b36c1d19d4a2e9eb0ce3606eb48': 1 },
      missing: ['0xc02aaa39b223fe8d0a0e5c4f27ead9083c756cc2'],
      sourceAvailable: true,
    });

    expect(() =>
      parseTokenPriceApiPayload({
        prices: { '0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48': -1 },
        coverage: { status: 'complete', missing: [] },
      }),
    ).toThrow('无效价格');
  });
});

describe('fetchTokenPriceCoverage', () => {
  it('batches beyond 100 tokens without silently dropping coverage', async () => {
    const tokens = Array.from(
      { length: 101 },
      (_, index) => `0x${(index + 1).toString(16).padStart(40, '0')}`,
    );
    const fetcher = async (input: RequestInfo | URL) => {
      const url = new URL(String(input), 'http://localhost');
      const addresses = url.searchParams.get('addresses')?.split(',') ?? [];
      return new Response(
        JSON.stringify({
          prices: Object.fromEntries(addresses.map((address) => [address, 1])),
          coverage: { status: 'complete', missing: [] },
        }),
        { status: 200 },
      );
    };

    const result = await fetchTokenPriceCoverage(1, tokens, fetcher as typeof fetch);
    expect(result.coverage).toMatchObject({
      status: 'complete',
      requested: 101,
      queried: 101,
      priced: 101,
      omitted: 0,
    });
  });

  it('reports the explicit safety budget instead of treating omitted prices as zero', async () => {
    const tokens = Array.from(
      { length: 501 },
      (_, index) => `0x${(index + 1).toString(16).padStart(40, '0')}`,
    );
    const fetcher = async (input: RequestInfo | URL) => {
      const url = new URL(String(input), 'http://localhost');
      const addresses = url.searchParams.get('addresses')?.split(',') ?? [];
      return new Response(
        JSON.stringify({
          prices: Object.fromEntries(addresses.map((address) => [address, 1])),
          coverage: { status: 'complete', missing: [] },
        }),
        { status: 200 },
      );
    };

    const result = await fetchTokenPriceCoverage(1, tokens, fetcher as typeof fetch);
    expect(result.coverage).toMatchObject({
      status: 'partial',
      requested: 501,
      queried: 500,
      priced: 500,
      omitted: 1,
    });
  });
});
