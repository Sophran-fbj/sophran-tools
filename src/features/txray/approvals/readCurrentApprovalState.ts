import { erc20Abi, erc721Abi, type Address, type PublicClient } from 'viem';
import { runInChunks } from '@/lib/web3/runInChunks';
import type { ApprovalIndexPayload, ApprovalPair } from './approvalIndex';
import { PERMIT2_ADDRESS, permit2Abi } from './permit2';
import {
  readBigIntResult,
  readBooleanResult,
  readPermit2Result,
} from './multicallResults';

const MULTICALL_CHUNK_SIZE = 100;

export interface LiveErc20Approval extends ApprovalPair {
  allowance: bigint;
}

export interface LivePermit2Approval extends ApprovalPair {
  amount: bigint;
  expiration: number;
}

export interface CurrentApprovalState {
  erc20: LiveErc20Approval[];
  nft: ApprovalPair[];
  permit2: LivePermit2Approval[];
  failedReads: number;
}

export async function readCurrentApprovalState(
  client: PublicClient,
  owner: Address,
  index: ApprovalIndexPayload,
): Promise<CurrentApprovalState> {
  const [allowances, nftApproved, permit2Allowances] = await Promise.all([
    runInChunks<ApprovalPair, unknown>(index.erc20, MULTICALL_CHUNK_SIZE, (chunk) =>
      client.multicall({
        allowFailure: true,
        contracts: chunk.map((pair) => ({
          address: pair.token,
          abi: erc20Abi,
          functionName: 'allowance',
          args: [owner, pair.spender],
        })),
      }),
    ),
    runInChunks<ApprovalPair, unknown>(index.nft, MULTICALL_CHUNK_SIZE, (chunk) =>
      client.multicall({
        allowFailure: true,
        contracts: chunk.map((pair) => ({
          address: pair.token,
          abi: erc721Abi,
          functionName: 'isApprovedForAll',
          args: [owner, pair.spender],
        })),
      }),
    ),
    runInChunks<ApprovalPair, unknown>(
      index.permit2,
      MULTICALL_CHUNK_SIZE,
      (chunk) =>
        client.multicall({
          allowFailure: true,
          contracts: chunk.map((pair) => ({
            address: PERMIT2_ADDRESS,
            abi: permit2Abi,
            functionName: 'allowance',
            args: [owner, pair.token, pair.spender],
          })),
        }),
    ),
  ]);

  const failedReads =
    allowances.filter((result) => readBigIntResult(result) === undefined).length +
    nftApproved.filter((result) => readBooleanResult(result) === undefined).length +
    permit2Allowances.filter((result) => readPermit2Result(result) === undefined)
      .length;

  const erc20 = index.erc20.flatMap((pair, itemIndex) => {
    const allowance = readBigIntResult(allowances[itemIndex]);
    return allowance !== undefined && allowance > 0n ? [{ ...pair, allowance }] : [];
  });
  const nft = index.nft.filter(
    (_, itemIndex) => readBooleanResult(nftApproved[itemIndex]) === true,
  );
  const now = Math.floor(Date.now() / 1000);
  const permit2 = index.permit2.flatMap((pair, itemIndex) => {
    const result = readPermit2Result(permit2Allowances[itemIndex]);
    if (!result) return [];
    const [amount, expiration] = result;
    return amount > 0n && Number(expiration) > now
      ? [{ ...pair, amount, expiration: Number(expiration) }]
      : [];
  });

  return { erc20, nft, permit2, failedReads };
}
