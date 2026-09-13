import {
  erc20Abi,
  erc721Abi,
  formatUnits,
  type Address,
  type PublicClient,
} from 'viem';
import { runInChunks } from '@/lib/web3/runInChunks';
import { PERMIT2_UNLIMITED_THRESHOLD } from './permit2';
import {
  readBigIntResult,
  readSuccessResult,
} from './multicallResults';
import type { CurrentApprovalState } from './readCurrentApprovalState';
import type {
  Approval,
  Erc20Approval,
  FungibleApprovalDisplay,
  NftApproval,
  Permit2Approval,
} from './types';

const UNLIMITED_THRESHOLD = 2n ** 200n;
const MULTICALL_CHUNK_SIZE = 100;

export interface EnrichedApprovals {
  approvals: Approval[];
  failedDecimals: number;
  failedBalances: number;
}

export async function enrichApprovals(
  client: PublicClient,
  owner: Address,
  current: CurrentApprovalState,
): Promise<EnrichedApprovals> {
  const fungible = [...current.erc20, ...current.permit2];
  const [metadata, balances, nftMetadata] = await Promise.all([
    runInChunks<(typeof fungible)[number], unknown>(
      fungible,
      MULTICALL_CHUNK_SIZE,
      (chunk) =>
        client.multicall({
          allowFailure: true,
          contracts: chunk.flatMap((pair) => [
            {
              address: pair.token,
              abi: erc20Abi,
              functionName: 'symbol',
            } as const,
            {
              address: pair.token,
              abi: erc20Abi,
              functionName: 'decimals',
            } as const,
          ]),
        }),
    ),
    runInChunks<(typeof fungible)[number], unknown>(
      fungible,
      MULTICALL_CHUNK_SIZE,
      (chunk) =>
        client.multicall({
          allowFailure: true,
          contracts: chunk.map((pair) => ({
            address: pair.token,
            abi: erc20Abi,
            functionName: 'balanceOf',
            args: [owner],
          })),
        }),
    ),
    runInChunks<(typeof current.nft)[number], unknown>(
      current.nft,
      MULTICALL_CHUNK_SIZE,
      (chunk) =>
        client.multicall({
          allowFailure: true,
          contracts: chunk.map((pair) => ({
            address: pair.token,
            abi: erc721Abi,
            functionName: 'symbol' as const,
          })),
        }),
    ),
  ]);

  const failedDecimals = fungible.filter(
    (_, index) => readSuccessResult(metadata[index * 2 + 1]) === undefined,
  ).length;
  const failedBalances = balances.filter(
    (result) => readBigIntResult(result) === undefined,
  ).length;

  function readDisplay(index: number, rawAmount: bigint): FungibleApprovalDisplay {
    const token = fungible[index].token;
    const symbolResult = readSuccessResult(metadata[index * 2]);
    const decimalsResult = readSuccessResult(metadata[index * 2 + 1]);
    const balance = readBigIntResult(balances[index]);
    const symbol =
      symbolResult !== undefined ? String(symbolResult) : shortAddress(token);
    const decimals = decimalsResult !== undefined ? Number(decimalsResult) : null;
    const amountText =
      decimals === null
        ? `${rawAmount.toString()} raw`
        : formatUnits(rawAmount, decimals);

    if (balance === undefined) return { symbol, decimals, amountText };
    const atRiskAmountRaw = rawAmount < balance ? rawAmount : balance;
    return {
      symbol,
      decimals,
      amountText,
      atRiskAmountRaw,
      atRiskAmountText:
        decimals === null
          ? `${atRiskAmountRaw.toString()} raw`
          : formatUnits(atRiskAmountRaw, decimals),
    };
  }

  const erc20: Erc20Approval[] = current.erc20.map((pair, index) => ({
    kind: 'erc20',
    id: pairKey(pair.token, pair.spender),
    token: pair.token,
    spender: pair.spender,
    allowance: pair.allowance,
    unlimited: pair.allowance > UNLIMITED_THRESHOLD,
    ...readDisplay(index, pair.allowance),
  }));
  const permit2: Permit2Approval[] = current.permit2.map((pair, index) => ({
    kind: 'permit2',
    id: `p2-${pairKey(pair.token, pair.spender)}`,
    token: pair.token,
    spender: pair.spender,
    amount: pair.amount,
    expiration: pair.expiration,
    unlimited: pair.amount > PERMIT2_UNLIMITED_THRESHOLD,
    ...readDisplay(current.erc20.length + index, pair.amount),
  }));
  const nft: NftApproval[] = current.nft.map((pair, index) => {
    const symbolResult = readSuccessResult(nftMetadata[index]);
    return {
      kind: 'nft',
      id: pairKey(pair.token, pair.spender),
      token: pair.token,
      spender: pair.spender,
      symbol:
        symbolResult !== undefined ? String(symbolResult) : shortAddress(pair.token),
    };
  });

  return {
    approvals: [...erc20, ...permit2, ...nft].sort(
      (left, right) => Number(isRisky(right)) - Number(isRisky(left)),
    ),
    failedDecimals,
    failedBalances,
  };
}

const pairKey = (token: Address, spender: Address) =>
  `${token.toLowerCase()}-${spender.toLowerCase()}`;

const shortAddress = (address: string) =>
  `${address.slice(0, 6)}…${address.slice(-4)}`;

const isRisky = (approval: Approval) =>
  (approval.kind === 'erc20' && approval.unlimited) ||
  (approval.kind === 'permit2' && approval.unlimited) ||
  approval.kind === 'nft';
