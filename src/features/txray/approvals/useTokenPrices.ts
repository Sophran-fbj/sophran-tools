'use client';

import { useQuery } from '@tanstack/react-query';
import type { Address } from 'viem';
import { getTxRayChain } from '../chains/chains';

export type TokenPrices = Record<string, number>;

export function useTokenPrices(chainId: number, tokens: Address[]) {
  const unique = [...new Set(tokens.map((token) => token.toLowerCase()))];
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

      const res = await fetch(url);
      if (!res.ok) return {};
      const json = (await res.json()) as Record<string, { usd?: number }>;
      const out: TokenPrices = {};
      for (const [addr, price] of Object.entries(json)) {
        if (typeof price.usd === 'number') out[addr.toLowerCase()] = price.usd;
      }
      return out;
    },
  });
}
