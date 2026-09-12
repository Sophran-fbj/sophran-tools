'use client';

import { useQuery } from '@tanstack/react-query';
import { usePublicClient } from 'wagmi';
import {
  erc20Abi,
  erc721Abi,
  formatUnits,
  getAddress,
  isAddress,
  type Address,
  type PublicClient,
} from 'viem';
import {
  PERMIT2_ADDRESS,
  PERMIT2_UNLIMITED_THRESHOLD,
  permit2Abi,
} from './permit2';

const UNLIMITED_THRESHOLD = 2n ** 200n;

interface FungibleApprovalDisplay {
  symbol: string;
  decimals: number | null;
  amountText: string;
  atRiskAmountRaw?: bigint;
  atRiskAmountText?: string;
}

export interface Erc20Approval extends FungibleApprovalDisplay {
  kind: 'erc20';
  id: string;
  token: Address;
  spender: Address;
  allowance: bigint;
  unlimited: boolean;
}

export interface NftApproval {
  kind: 'nft';
  id: string;
  token: Address;
  spender: Address;
  symbol: string;
}

export interface Permit2Approval extends FungibleApprovalDisplay {
  kind: 'permit2';
  id: string;
  token: Address;
  spender: Address;
  amount: bigint;
  expiration: number;
  unlimited: boolean;
}

export type Approval = Erc20Approval | NftApproval | Permit2Approval;

export interface ApprovalScanResult {
  approvals: Approval[];
  status: 'complete' | 'partial';
  warnings: string[];
}

interface Pair {
  token: Address;
  spender: Address;
}

interface ApprovalIndexPayload {
  erc20: Pair[];
  nft: Pair[];
  permit2: Pair[];
  coverage: {
    status: 'complete' | 'partial';
    truncatedSources: string[];
    maxRecordsPerSource: number;
  };
}

const pairKey = (token: Address, spender: Address) =>
  `${token.toLowerCase()}-${spender.toLowerCase()}`;

const shortAddr = (address: string) =>
  `${address.slice(0, 6)}…${address.slice(-4)}`;

const isRisky = (approval: Approval) =>
  (approval.kind === 'erc20' && approval.unlimited) ||
  (approval.kind === 'permit2' && approval.unlimited) ||
  approval.kind === 'nft';

export function useApprovals(owner: Address | undefined, chainId = 1) {
  const client = usePublicClient({ chainId });

  return useQuery<ApprovalScanResult>({
    queryKey: ['approvals', chainId, owner?.toLowerCase()],
    enabled: Boolean(owner && client),
    staleTime: 60_000,
    queryFn: async () => {
      if (!client || !owner) throw new Error('RPC 或查询地址不可用');
      return fetchApprovals(client as PublicClient, owner, chainId);
    },
  });
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
}

function readBigIntResult(result: unknown): bigint | undefined {
  if (!isRecord(result) || result.status !== 'success') return undefined;
  return typeof result.result === 'bigint' ? result.result : undefined;
}

function readPermit2Result(
  result: unknown,
): readonly [bigint, bigint, bigint] | undefined {
  if (!isRecord(result) || result.status !== 'success' || !Array.isArray(result.result)) {
    return undefined;
  }
  const [amount, expiration, nonce] = result.result;
  return typeof amount === 'bigint' &&
    typeof expiration === 'bigint' &&
    typeof nonce === 'bigint'
    ? [amount, expiration, nonce]
    : undefined;
}

function readBooleanResult(result: unknown): boolean | undefined {
  if (!isRecord(result) || result.status !== 'success') return undefined;
  return typeof result.result === 'boolean' ? result.result : undefined;
}

function parsePairs(value: unknown, field: string): Pair[] {
  if (!Array.isArray(value)) throw new Error(`授权索引响应缺少 ${field}`);
  return value.map((item) => {
    if (
      !isRecord(item) ||
      typeof item.token !== 'string' ||
      typeof item.spender !== 'string' ||
      !isAddress(item.token) ||
      !isAddress(item.spender)
    ) {
      throw new Error(`授权索引返回了无效的 ${field} 地址`);
    }
    return { token: getAddress(item.token), spender: getAddress(item.spender) };
  });
}

export function parseApprovalIndexPayload(value: unknown): ApprovalIndexPayload {
  if (!isRecord(value)) throw new Error('授权索引返回了无效响应');
  if (isRecord(value.error)) {
    throw new Error(
      typeof value.error.message === 'string' ? value.error.message : '授权索引查询失败',
    );
  }
  if (!isRecord(value.coverage)) throw new Error('授权索引响应缺少覆盖范围信息');

  const coverageStatus = value.coverage.status;
  const truncatedSources = value.coverage.truncatedSources;
  const maxRecordsPerSource = value.coverage.maxRecordsPerSource;
  if (
    (coverageStatus !== 'complete' && coverageStatus !== 'partial') ||
    !Array.isArray(truncatedSources) ||
    !truncatedSources.every((source) => typeof source === 'string') ||
    typeof maxRecordsPerSource !== 'number'
  ) {
    throw new Error('授权索引返回了无效的覆盖范围信息');
  }

  return {
    erc20: parsePairs(value.erc20, 'erc20'),
    nft: parsePairs(value.nft, 'nft'),
    permit2: parsePairs(value.permit2, 'permit2'),
    coverage: {
      status: coverageStatus,
      truncatedSources,
      maxRecordsPerSource,
    },
  };
}

async function fetchApprovals(
  client: PublicClient,
  owner: Address,
  chainId: number,
): Promise<ApprovalScanResult> {
  const response = await fetch(`/api/approvals?owner=${owner}&chainId=${chainId}`);
  const json: unknown = await response.json();
  if (!response.ok) {
    if (isRecord(json) && isRecord(json.error) && typeof json.error.message === 'string') {
      throw new Error(json.error.message);
    }
    throw new Error('获取授权记录失败');
  }
  const index = parseApprovalIndexPayload(json);
  const warnings: string[] = [];
  if (index.coverage.status === 'partial') {
    warnings.push(
      `历史事件超过单类 ${index.coverage.maxRecordsPerSource.toLocaleString()} 条，结果已截断，不能视为完整扫描。`,
    );
  }

  const [allowances, nftApproved, permit2Allowances] = await Promise.all([
    index.erc20.length
      ? client.multicall({
          allowFailure: true,
          contracts: index.erc20.map((pair) => ({
            address: pair.token,
            abi: erc20Abi,
            functionName: 'allowance',
            args: [owner, pair.spender],
          })),
        })
      : [],
    index.nft.length
      ? client.multicall({
          allowFailure: true,
          contracts: index.nft.map((pair) => ({
            address: pair.token,
            abi: erc721Abi,
            functionName: 'isApprovedForAll',
            args: [owner, pair.spender],
          })),
        })
      : [],
    index.permit2.length
      ? client.multicall({
          allowFailure: true,
          contracts: index.permit2.map((pair) => ({
            address: PERMIT2_ADDRESS,
            abi: permit2Abi,
            functionName: 'allowance',
            args: [owner, pair.token, pair.spender],
          })),
        })
      : [],
  ]);

  const failedCurrentReads =
    allowances.filter((result) => readBigIntResult(result) === undefined).length +
    nftApproved.filter((result) => readBooleanResult(result) === undefined).length +
    permit2Allowances.filter((result) => readPermit2Result(result) === undefined).length;
  if (failedCurrentReads > 0) {
    warnings.push(
      `${failedCurrentReads} 条授权的实时状态读取失败；这些条目未被当作安全或已撤销。`,
    );
  }

  const liveErc20 = index.erc20.flatMap((pair, index) => {
    const allowance = readBigIntResult(allowances[index]);
    return allowance !== undefined && allowance > 0n ? [{ ...pair, allowance }] : [];
  });

  const liveNft = index.nft.filter((_, index) => {
    return readBooleanResult(nftApproved[index]) === true;
  });

  const now = Math.floor(Date.now() / 1000);
  const livePermit2 = index.permit2.flatMap((pair, index) => {
    const result = readPermit2Result(permit2Allowances[index]);
    if (!result) return [];
    const [amount, expiration] = result;
    return amount > 0n && Number(expiration) > now
      ? [{ ...pair, amount, expiration: Number(expiration) }]
      : [];
  });

  const fungibleTokens = [...liveErc20, ...livePermit2];
  const [metadata, balances, nftMetadata] = await Promise.all([
    fungibleTokens.length
      ? client.multicall({
          allowFailure: true,
          contracts: fungibleTokens.flatMap((pair) => [
            { address: pair.token, abi: erc20Abi, functionName: 'symbol' } as const,
            { address: pair.token, abi: erc20Abi, functionName: 'decimals' } as const,
          ]),
        })
      : [],
    fungibleTokens.length
      ? client.multicall({
          allowFailure: true,
          contracts: fungibleTokens.map((pair) => ({
            address: pair.token,
            abi: erc20Abi,
            functionName: 'balanceOf',
            args: [owner],
          })),
        })
      : [],
    liveNft.length
      ? client.multicall({
          allowFailure: true,
          contracts: liveNft.map((pair) => ({
            address: pair.token,
            abi: erc721Abi,
            functionName: 'symbol' as const,
          })),
        })
      : [],
  ]);

  const failedDecimals = fungibleTokens.filter(
    (_, index) => metadata[index * 2 + 1]?.status !== 'success',
  ).length;
  const failedBalances = balances.filter((result) => result.status === 'failure').length;
  if (failedDecimals > 0) {
    warnings.push(`${failedDecimals} 个代币的 decimals 读取失败，额度将显示为原始整数。`);
  }
  if (failedBalances > 0) {
    warnings.push(`${failedBalances} 个代币的余额读取失败，暴露金额未知。`);
  }

  function readDisplay(index: number, rawAmount: bigint): FungibleApprovalDisplay {
    const token = fungibleTokens[index].token;
    const symbolResult = metadata[index * 2];
    const decimalsResult = metadata[index * 2 + 1];
    const balance = readBigIntResult(balances[index]);
    const symbol =
      symbolResult?.status === 'success' ? String(symbolResult.result) : shortAddr(token);
    const decimals =
      decimalsResult?.status === 'success' ? Number(decimalsResult.result) : null;
    const amountText = decimals === null ? `${rawAmount.toString()} raw` : formatUnits(rawAmount, decimals);

    if (balance === undefined) {
      return { symbol, decimals, amountText };
    }
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

  const erc20Result: Erc20Approval[] = liveErc20.map((pair, index) => {
    const display = readDisplay(index, pair.allowance);
    const unlimited = pair.allowance > UNLIMITED_THRESHOLD;
    return {
      kind: 'erc20',
      id: pairKey(pair.token, pair.spender),
      token: pair.token,
      spender: pair.spender,
      allowance: pair.allowance,
      unlimited,
      ...display,
      amountText: unlimited ? '无限' : display.amountText,
    };
  });

  const permit2Result: Permit2Approval[] = livePermit2.map((pair, index) => {
    const displayIndex = liveErc20.length + index;
    const display = readDisplay(displayIndex, pair.amount);
    const unlimited = pair.amount > PERMIT2_UNLIMITED_THRESHOLD;
    return {
      kind: 'permit2',
      id: `p2-${pairKey(pair.token, pair.spender)}`,
      token: pair.token,
      spender: pair.spender,
      amount: pair.amount,
      expiration: pair.expiration,
      unlimited,
      ...display,
      amountText: unlimited ? '无限' : display.amountText,
    };
  });

  const nftResult: NftApproval[] = liveNft.map((pair, index) => {
    const symbolResult = nftMetadata[index];
    return {
      kind: 'nft',
      id: pairKey(pair.token, pair.spender),
      token: pair.token,
      spender: pair.spender,
      symbol:
        symbolResult?.status === 'success'
          ? String(symbolResult.result)
          : shortAddr(pair.token),
    };
  });

  const approvals = [...erc20Result, ...permit2Result, ...nftResult].sort(
    (a, b) => Number(isRisky(b)) - Number(isRisky(a)),
  );
  return {
    approvals,
    status: warnings.length ? 'partial' : 'complete',
    warnings,
  };
}
