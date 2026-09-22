import { isAddress } from 'viem';
import { isRecord } from '@/lib/validation';

export type TokenPrices = Record<string, number>;

export interface TokenPriceCoverage {
  status: 'complete' | 'partial' | 'unavailable';
  requested: number;
  queried: number;
  priced: number;
  missing: string[];
  omitted: number;
}

export interface TokenPriceResult {
  prices: TokenPrices;
  coverage: TokenPriceCoverage;
}

export function parseCoinGeckoTokenPrices(value: unknown): TokenPrices {
  if (!isRecord(value)) return {};
  const result: TokenPrices = {};
  for (const [address, price] of Object.entries(value)) {
    if (!isAddress(address) || !isRecord(price)) continue;
    const usd = price.usd;
    if (typeof usd === 'number' && Number.isFinite(usd) && usd >= 0) {
      result[address.toLowerCase()] = usd;
    }
  }
  return result;
}

export function parseTokenPriceApiPayload(value: unknown): {
  prices: TokenPrices;
  missing: string[];
  sourceAvailable: boolean;
} {
  if (!isRecord(value) || !isRecord(value.prices) || !isRecord(value.coverage)) {
    throw new Error('价格服务返回了无效响应');
  }
  const prices: TokenPrices = {};
  for (const [address, price] of Object.entries(value.prices)) {
    if (
      !isAddress(address) ||
      typeof price !== 'number' ||
      !Number.isFinite(price) ||
      price < 0
    ) {
      throw new Error('价格服务返回了无效价格');
    }
    prices[address.toLowerCase()] = price;
  }
  const missing = value.coverage.missing;
  const status = value.coverage.status;
  if (
    !Array.isArray(missing) ||
    !missing.every((address) => typeof address === 'string' && isAddress(address)) ||
    (status !== 'complete' && status !== 'partial' && status !== 'unavailable')
  ) {
    throw new Error('价格服务返回了无效覆盖信息');
  }
  return {
    prices,
    missing: missing.map((address) => address.toLowerCase()),
    sourceAvailable: status !== 'unavailable',
  };
}
