export interface TxRayChain {
  id: number;
  name: string;
  shortName: string;
  explorerName: string;
  explorerUrl: string;
  coinGeckoPlatformId: string;
}

export const TXRAY_CHAINS: TxRayChain[] = [
  {
    id: 1,
    name: 'Ethereum',
    shortName: 'ETH',
    explorerName: 'Etherscan',
    explorerUrl: 'https://etherscan.io',
    coinGeckoPlatformId: 'ethereum',
  },
  {
    id: 8453,
    name: 'Base',
    shortName: 'Base',
    explorerName: 'BaseScan',
    explorerUrl: 'https://basescan.org',
    coinGeckoPlatformId: 'base',
  },
  {
    id: 42161,
    name: 'Arbitrum',
    shortName: 'ARB',
    explorerName: 'Arbiscan',
    explorerUrl: 'https://arbiscan.io',
    coinGeckoPlatformId: 'arbitrum-one',
  },
  {
    id: 10,
    name: 'Optimism',
    shortName: 'OP',
    explorerName: 'Optimistic Etherscan',
    explorerUrl: 'https://optimistic.etherscan.io',
    coinGeckoPlatformId: 'optimistic-ethereum',
  },
];

export const DEFAULT_TXRAY_CHAIN_ID = 1;

export function getTxRayChain(chainId: number): TxRayChain {
  return (
    TXRAY_CHAINS.find((chain) => chain.id === chainId) ??
    TXRAY_CHAINS[0]
  );
}

export function isSupportedTxRayChain(chainId: number): boolean {
  return TXRAY_CHAINS.some((chain) => chain.id === chainId);
}

export function explorerAddressUrl(chainId: number, address: string): string {
  return `${getTxRayChain(chainId).explorerUrl}/address/${address}`;
}

export function explorerTxUrl(chainId: number, hash: string): string {
  return `${getTxRayChain(chainId).explorerUrl}/tx/${hash}`;
}
