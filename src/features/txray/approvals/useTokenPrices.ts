'use client';

import { useQuery } from '@tanstack/react-query';
import type { Address } from 'viem';
import { getTxRayChain } from '../chains/chains';
import { isRecord } from '@/lib/validation';

export type TokenPrices = Record<string, number>;

const MAX_PRICE_TOKENS = 100;

export function useTokenPrices(chainId: number, tokens: Address[]) {
  const unique = [...new Set(tokens.map((token) => token.toLowerCase()))]
    .sort()
    .slice(0, MAX_PRICE_TOKENS);
  const platformId = getTxRayChain(chainId).coinGeckoPlatformId;

  return useQuery<TokenPrices>({
    queryKey: ['token-prices', chainId, unique.join(',')],
    enabled: unique.length > 0,
    staleTime: 5 * 60_000,
    retry: false,
    queryFn: async () => {
      const url = new URL(
        `https://api.coingecko.com/api/v3/simple/token_price/${platformId}`,
      );
      url.searchParams.set('contract_addresses', unique.join(','));
      url.searchParams.set('vs_currencies', 'usd');

      const res = await fetch(url, { signal: AbortSignal.timeout(8_000) });
      if (!res.ok) return {};
      return parseTokenPrices(await res.json());
    },
  });
}

export function parseTokenPrices(value: unknown): TokenPrices {
  if (!isRecord(value)) return {};

  const result: TokenPrices = {};
  for (const [address, price] of Object.entries(value)) {
    if (!isRecord(price)) continue;
    const usd = price.usd;
    if (typeof usd === 'number' && Number.isFinite(usd) && usd >= 0) {
      result[address.toLowerCase()] = usd;
    }
  }
  return result;
}
