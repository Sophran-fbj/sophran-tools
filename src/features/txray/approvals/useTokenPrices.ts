'use client';

import { useQuery } from '@tanstack/react-query';
import type { Address } from 'viem';
import {
  parseCoinGeckoTokenPrices,
  parseTokenPriceApiPayload,
  type TokenPriceResult,
} from './tokenPrices';

const MAX_PRICE_TOKENS = 500;
const PRICE_BATCH_SIZE = 100;

export async function fetchTokenPriceCoverage(
  chainId: number,
  tokens: string[],
  fetcher: typeof fetch = fetch,
): Promise<TokenPriceResult> {
  const unique = [...new Set(tokens.map((token) => token.toLowerCase()))].sort();
  const queried = unique.slice(0, MAX_PRICE_TOKENS);
  const omitted = unique.length - queried.length;
  const prices: Record<string, number> = {};
  const missing = new Set<string>();
  let sourceAvailable = true;

  for (let index = 0; index < queried.length; index += PRICE_BATCH_SIZE) {
    const batch = queried.slice(index, index + PRICE_BATCH_SIZE);
    const params = new URLSearchParams({
      chainId: String(chainId),
      addresses: batch.join(','),
    });
    try {
      const response = await fetcher(`/api/token-prices?${params}`, {
        signal: AbortSignal.timeout(10_000),
      });
      if (!response.ok) throw new Error(`price route HTTP ${response.status}`);
      const parsed = parseTokenPriceApiPayload(await response.json());
      Object.assign(prices, parsed.prices);
      parsed.missing.forEach((address) => missing.add(address));
      if (!parsed.sourceAvailable) sourceAvailable = false;
    } catch {
      sourceAvailable = false;
      batch.forEach((address) => missing.add(address));
    }
  }

  const priced = Object.keys(prices).length;
  const status = !sourceAvailable && priced === 0
    ? 'unavailable'
    : omitted > 0 || missing.size > 0 || !sourceAvailable
      ? 'partial'
      : 'complete';
  return {
    prices,
    coverage: {
      status,
      requested: unique.length,
      queried: queried.length,
      priced,
      missing: [...missing],
      omitted,
    },
  };
}

export function useTokenPrices(chainId: number, tokens: Address[]) {
  const unique = [...new Set(tokens.map((token) => token.toLowerCase()))].sort();
  const queried = unique.slice(0, MAX_PRICE_TOKENS);
  const omitted = unique.length - queried.length;

  return useQuery<TokenPriceResult>({
    queryKey: ['token-prices', chainId, queried.join(','), omitted],
    enabled: queried.length > 0,
    staleTime: 5 * 60_000,
    retry: false,
    queryFn: () => fetchTokenPriceCoverage(chainId, unique),
  });
}

export const parseTokenPrices = parseCoinGeckoTokenPrices;
