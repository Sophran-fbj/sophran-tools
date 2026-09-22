import { NextResponse, type NextRequest } from 'next/server';
import { getAddress, isAddress } from 'viem';
import { getTxRayChain, isSupportedTxRayChain } from '@/features/txray/chains/chains';
import { parseCoinGeckoTokenPrices } from '@/features/txray/approvals/tokenPrices';
import { checkRateLimit, requestClientKey } from '@/lib/server/requestGuard';

const MAX_TOKENS_PER_REQUEST = 100;
const KEYLESS_UPSTREAM_BATCH_SIZE = 1;
const CACHE_TTL_MS = 5 * 60_000;
const MAX_CACHE_ENTRIES = 10_000;
const UPSTREAM_TIMEOUT_MS = 8_000;

interface CachedPrice {
  price?: number;
  expiresAt: number;
}

const priceCache = new Map<string, CachedPrice>();
const inFlight = new Map<string, Promise<Record<string, number>>>();

function cacheKey(chainId: number, address: string) {
  return `${chainId}:${address.toLowerCase()}`;
}

function pruneCache(now: number) {
  if (priceCache.size < MAX_CACHE_ENTRIES) return;
  for (const [key, value] of priceCache) {
    if (value.expiresAt <= now) priceCache.delete(key);
  }
  while (priceCache.size >= MAX_CACHE_ENTRIES) {
    const oldestKey = priceCache.keys().next().value;
    if (typeof oldestKey !== 'string') break;
    priceCache.delete(oldestKey);
  }
}

async function fetchPrices(chainId: number, addresses: string[]) {
  const platform = getTxRayChain(chainId).coinGeckoPlatformId;
  const url = new URL(
    `https://api.coingecko.com/api/v3/simple/token_price/${platform}`,
  );
  url.searchParams.set('contract_addresses', addresses.join(','));
  url.searchParams.set('vs_currencies', 'usd');
  const headers: Record<string, string> = { Accept: 'application/json' };
  if (process.env.COINGECKO_DEMO_API_KEY) {
    headers['x-cg-demo-api-key'] = process.env.COINGECKO_DEMO_API_KEY;
  }
  const response = await fetch(url, {
    cache: 'no-store',
    headers,
    signal: AbortSignal.timeout(UPSTREAM_TIMEOUT_MS),
  });
  if (!response.ok) throw new Error(`CoinGecko HTTP ${response.status}`);
  return parseCoinGeckoTokenPrices(await response.json());
}

export async function GET(request: NextRequest) {
  const rateLimit = await checkRateLimit(
    `token-prices:${requestClientKey(request.headers)}`,
    30,
    60_000,
  );
  if (!rateLimit.allowed) {
    return NextResponse.json(
      { error: { code: 'RATE_LIMITED', message: '请求过于频繁，请稍后重试' } },
      {
        status: 429,
        headers: {
          'Retry-After': String(rateLimit.retryAfterSeconds),
          'X-TxRay-Guard': rateLimit.backend,
        },
      },
    );
  }

  const chainId = Number(request.nextUrl.searchParams.get('chainId') ?? '1');
  if (!isSupportedTxRayChain(chainId)) {
    return NextResponse.json(
      { error: { code: 'UNSUPPORTED_CHAIN', message: '暂不支持该链' } },
      { status: 400 },
    );
  }
  const raw = request.nextUrl.searchParams.get('addresses') ?? '';
  const requested = raw.split(',').map((address) => address.trim()).filter(Boolean);
  if (requested.length > MAX_TOKENS_PER_REQUEST) {
    return NextResponse.json(
      {
        error: {
          code: 'TOO_MANY_ADDRESSES',
          message: `一次最多查询 ${MAX_TOKENS_PER_REQUEST} 个价格`,
        },
      },
      { status: 400 },
    );
  }
  const addresses = [
    ...new Set(
      requested
        .filter((address): address is `0x${string}` => isAddress(address))
        .map((address) => getAddress(address).toLowerCase()),
    ),
  ];
  if (addresses.length !== requested.length) {
    return NextResponse.json(
      { error: { code: 'INVALID_ADDRESS', message: '地址列表包含无效或重复地址' } },
      { status: 400 },
    );
  }

  const now = Date.now();
  pruneCache(now);
  const prices: Record<string, number> = {};
  const uncached: string[] = [];
  for (const address of addresses) {
    const cached = priceCache.get(cacheKey(chainId, address));
    if (!cached || cached.expiresAt <= now) {
      uncached.push(address);
    } else if (cached.price !== undefined) {
      prices[address] = cached.price;
    }
  }

  let sourceAvailable = true;
  if (uncached.length > 0) {
    // CoinGecko's unauthenticated allowance can be reduced dynamically (it is
    // currently one contract per request). Avoid a burst of keyless upstream
    // calls: resolve one uncached token and report the rest as partial coverage.
    const hasDemoKey = Boolean(process.env.COINGECKO_DEMO_API_KEY);
    const upstreamAddresses = hasDemoKey
      ? uncached
      : uncached.slice(0, KEYLESS_UPSTREAM_BATCH_SIZE);
    const flightKey = `${chainId}:${upstreamAddresses.join(',')}`;
    try {
      let pending = inFlight.get(flightKey);
      if (!pending) {
        pending = fetchPrices(chainId, upstreamAddresses);
        inFlight.set(flightKey, pending);
      }
      const fetched = await pending;
      const expiresAt = Date.now() + CACHE_TTL_MS;
      for (const address of upstreamAddresses) {
        const price = fetched[address];
        priceCache.set(cacheKey(chainId, address), { price, expiresAt });
        if (price !== undefined) prices[address] = price;
      }
    } catch (error) {
      sourceAvailable = false;
      console.error('[token-prices] CoinGecko request failed', {
        chainId,
        count: upstreamAddresses.length,
        message: error instanceof Error ? error.message : 'unknown error',
      });
    } finally {
      inFlight.delete(flightKey);
    }
  }

  const missing = addresses.filter((address) => prices[address] === undefined);
  const status = !sourceAvailable
    ? 'unavailable'
    : missing.length > 0
      ? 'partial'
      : 'complete';
  return NextResponse.json(
    {
      prices,
      coverage: {
        status,
        requested: addresses.length,
        priced: Object.keys(prices).length,
        missing,
        source: 'CoinGecko',
        checkedAt: Date.now(),
      },
    },
    {
      headers: {
        'Cache-Control': sourceAvailable
          ? 'public, max-age=60, s-maxage=300'
          : 'no-store',
        'X-TxRay-Guard': rateLimit.backend,
      },
    },
  );
}
