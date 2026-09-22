import { afterEach, describe, expect, it, vi } from 'vitest';
import { NextRequest } from 'next/server';
import { GET as getApprovals } from './approvals/route';
import { GET as decodeSignature } from './decode-sig/route';
import { GET as getSpenderInfo } from './spender-info/route';
import { GET as getTokenPrices } from './token-prices/route';

const originalEtherscanKey = process.env.ETHERSCAN_API_KEY;
const originalCoinGeckoKey = process.env.COINGECKO_DEMO_API_KEY;

afterEach(() => {
  if (originalEtherscanKey === undefined) {
    delete process.env.ETHERSCAN_API_KEY;
  } else {
    process.env.ETHERSCAN_API_KEY = originalEtherscanKey;
  }
  if (originalCoinGeckoKey === undefined) {
    delete process.env.COINGECKO_DEMO_API_KEY;
  } else {
    process.env.COINGECKO_DEMO_API_KEY = originalCoinGeckoKey;
  }
  vi.unstubAllGlobals();
});

function request(path: string, ip: string): NextRequest {
  return new NextRequest(`http://localhost${path}`, {
    headers: { 'x-forwarded-for': ip },
  });
}

describe('API input boundaries', () => {
  it('rejects malformed selectors before calling OpenChain', async () => {
    const response = await decodeSignature(
      request('/api/decode-sig?selector=0x1234', 'test-decode'),
    );
    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toMatchObject({ signature: null });
  });

  it('rejects unsupported spender-info chains', async () => {
    const response = await getSpenderInfo(
      request('/api/spender-info?chainId=999&addresses=', 'test-spender'),
    );
    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toMatchObject({
      error: { code: 'UNSUPPORTED_CHAIN' },
    });
  });

  it('validates token-price boundaries without calling CoinGecko', async () => {
    const unsupported = await getTokenPrices(
      request('/api/token-prices?chainId=999&addresses=', 'test-prices-chain'),
    );
    expect(unsupported.status).toBe(400);

    const tooMany = Array.from(
      { length: 101 },
      (_, index) => `0x${index.toString(16).padStart(40, '0')}`,
    ).join(',');
    const oversized = await getTokenPrices(
      request(
        `/api/token-prices?chainId=1&addresses=${tooMany}`,
        'test-prices-count',
      ),
    );
    expect(oversized.status).toBe(400);
    await expect(oversized.json()).resolves.toMatchObject({
      error: { code: 'TOO_MANY_ADDRESSES' },
    });

    const empty = await getTokenPrices(
      request('/api/token-prices?chainId=1&addresses=', 'test-prices-empty'),
    );
    expect(empty.status).toBe(200);
    await expect(empty.json()).resolves.toMatchObject({
      prices: {},
      coverage: { status: 'complete', requested: 0, priced: 0 },
    });
  });

  it('degrades keyless token pricing to explicit partial coverage', async () => {
    delete process.env.COINGECKO_DEMO_API_KEY;
    const first = '0x1111111111111111111111111111111111111111';
    const second = '0x2222222222222222222222222222222222222222';
    const fetchMock = vi.fn(async (input: RequestInfo | URL) => {
      const url = new URL(String(input));
      expect(url.searchParams.get('contract_addresses')).toBe(first);
      return new Response(JSON.stringify({ [first]: { usd: 1 } }));
    });
    vi.stubGlobal('fetch', fetchMock);

    const response = await getTokenPrices(
      request(
        `/api/token-prices?chainId=1&addresses=${first},${second}`,
        'test-prices-keyless',
      ),
    );

    expect(fetchMock).toHaveBeenCalledTimes(1);
    await expect(response.json()).resolves.toMatchObject({
      prices: { [first]: 1 },
      coverage: {
        status: 'partial',
        requested: 2,
        priced: 1,
        missing: [second],
      },
    });
  });

  it('batches token prices when a server-side Demo key is configured', async () => {
    process.env.COINGECKO_DEMO_API_KEY = 'test-demo-key';
    const first = '0x3333333333333333333333333333333333333333';
    const second = '0x4444444444444444444444444444444444444444';
    const fetchMock = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = new URL(String(input));
      expect(url.searchParams.get('contract_addresses')).toBe(`${first},${second}`);
      expect(init?.headers).toMatchObject({
        'x-cg-demo-api-key': 'test-demo-key',
      });
      return new Response(
        JSON.stringify({ [first]: { usd: 1 }, [second]: { usd: 2 } }),
      );
    });
    vi.stubGlobal('fetch', fetchMock);

    const response = await getTokenPrices(
      request(
        `/api/token-prices?chainId=1&addresses=${first},${second}`,
        'test-prices-demo-key',
      ),
    );

    expect(fetchMock).toHaveBeenCalledTimes(1);
    await expect(response.json()).resolves.toMatchObject({
      prices: { [first]: 1, [second]: 2 },
      coverage: { status: 'complete', requested: 2, priced: 2, missing: [] },
    });
  });

  it('validates approval input before checking server configuration', async () => {
    delete process.env.ETHERSCAN_API_KEY;
    const invalid = await getApprovals(
      request('/api/approvals?owner=invalid&chainId=1', 'test-approval-invalid'),
    );
    expect(invalid.status).toBe(400);

    const valid = await getApprovals(
      request(
        '/api/approvals?owner=0x0000000000000000000000000000000000000001&chainId=1',
        'test-approval-config',
      ),
    );
    expect(valid.status).toBe(503);
    await expect(valid.json()).resolves.toMatchObject({
      error: { code: 'CONFIG_MISSING' },
    });
  });
});
