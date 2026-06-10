'use client';

import { useQuery } from '@tanstack/react-query';
import { usePublicClient } from 'wagmi';
import {
  erc20Abi,
  erc721Abi,
  formatUnits,
  type Address,
  type PublicClient,
} from 'viem';
import {
  PERMIT2_ADDRESS,
  PERMIT2_UNLIMITED_THRESHOLD,
  permit2Abi,
} from './permit2';

const UNLIMITED_THRESHOLD = 2n ** 200n;

export interface Erc20Approval {
  kind: 'erc20';
  id: string;
  token: Address;
  spender: Address;
  allowance: bigint;
  unlimited: boolean;
  symbol: string;
  decimals: number;
  amountText: string;
  atRiskAmountRaw: bigint;
  atRiskAmountText: string;
}

export interface NftApproval {
  kind: 'nft';
  id: string;
  token: Address;
  spender: Address;
  symbol: string;
}

export interface Permit2Approval {
  kind: 'permit2';
  id: string;
  token: Address;
  spender: Address;
  amount: bigint;
  expiration: number; // unix 秒
  unlimited: boolean;
  symbol: string;
  decimals: number;
  amountText: string;
  atRiskAmountRaw: bigint;
  atRiskAmountText: string;
}

export type Approval = Erc20Approval | NftApproval | Permit2Approval;

interface Pair {
  token: Address;
  spender: Address;
}

const pairKey = (token: Address, spender: Address) =>
  `${token.toLowerCase()}-${spender.toLowerCase()}`;

const shortAddr = (addr: string) => `${addr.slice(0, 6)}…${addr.slice(-4)}`;

const isRisky = (a: Approval) =>
  (a.kind === 'erc20' && a.unlimited) ||
  (a.kind === 'permit2' && a.unlimited) ||
  a.kind === 'nft';

export function useApprovals(owner: Address | undefined, chainId = 1) {
  const client = usePublicClient({ chainId });

  return useQuery<Approval[]>({
    queryKey: ['approvals', chainId, owner?.toLowerCase()],
    enabled: Boolean(owner && client),
    staleTime: 60_000,
    queryFn: () => fetchApprovals(client as PublicClient, owner as Address, chainId),
  });
}

async function fetchApprovals(
  client: PublicClient,
  owner: Address,
  chainId: number,
): Promise<Approval[]> {
  // 1) 历史授权对来自服务端（Etherscan getLogs）
  const res = await fetch(`/api/approvals?owner=${owner}&chainId=${chainId}`);
  const json = await res.json();
  if (!res.ok) throw new Error(json.error ?? '获取授权记录失败');
  const erc20Pairs = json.erc20 as Pair[];
  const nftPairs = json.nft as Pair[];
  const permit2Pairs = json.permit2 as Pair[];

  // 2) multicall 校验当前状态
  const [allowances, nftApproved, permit2Allowances] = await Promise.all([
    erc20Pairs.length
      ? client.multicall({
          allowFailure: true,
          contracts: erc20Pairs.map((p) => ({
            address: p.token,
            abi: erc20Abi,
            functionName: 'allowance',
            args: [owner, p.spender],
          })),
        })
      : [],
    nftPairs.length
      ? client.multicall({
          allowFailure: true,
          contracts: nftPairs.map((p) => ({
            address: p.token,
            abi: erc721Abi,
            functionName: 'isApprovedForAll',
            args: [owner, p.spender],
          })),
        })
      : [],
    permit2Pairs.length
      ? client.multicall({
          allowFailure: true,
          contracts: permit2Pairs.map((p) => ({
            address: PERMIT2_ADDRESS,
            abi: permit2Abi,
            functionName: 'allowance',
            args: [owner, p.token, p.spender],
          })),
        })
      : [],
  ]);

  const liveErc20 = erc20Pairs
    .map((p, i) => {
      const r = allowances[i];
      return r?.status === 'success'
        ? { ...p, allowance: r.result as bigint }
        : null;
    })
    .filter(
      (x): x is { token: Address; spender: Address; allowance: bigint } =>
        x !== null && x.allowance > 0n,
    );

  const liveNft = nftPairs.filter((_, i) => {
    const r = nftApproved[i];
    return r?.status === 'success' && Boolean(r.result);
  });

  const now = Math.floor(Date.now() / 1000);
  const livePermit2 = permit2Pairs
    .map((p, i) => {
      const r = permit2Allowances[i];
      if (r?.status !== 'success') return null;
      const [amount, expiration] = r.result as readonly [bigint, bigint, bigint];
      return { ...p, amount, expiration: Number(expiration) };
    })
    .filter(
      (x): x is { token: Address; spender: Address; amount: bigint; expiration: number } =>
        x !== null && x.amount > 0n && x.expiration > now,
    );

  // 3) multicall 读元数据（symbol / decimals）—— ERC20 与 Permit2 的 token 都是 ERC20
  const erc20MetaTokens = [...liveErc20, ...livePermit2];
  const [erc20Meta, erc20Balances, nftMeta] = await Promise.all([
    erc20MetaTokens.length
      ? client.multicall({
          allowFailure: true,
          contracts: erc20MetaTokens.flatMap((p) => [
            { address: p.token, abi: erc20Abi, functionName: 'symbol' } as const,
            { address: p.token, abi: erc20Abi, functionName: 'decimals' } as const,
          ]),
        })
      : [],
    erc20MetaTokens.length
      ? client.multicall({
          allowFailure: true,
          contracts: erc20MetaTokens.map((p) => ({
            address: p.token,
            abi: erc20Abi,
            functionName: 'balanceOf',
            args: [owner],
          })),
        })
      : [],
    liveNft.length
      ? client.multicall({
          allowFailure: true,
          contracts: liveNft.map((p) => ({
            address: p.token,
            abi: erc721Abi,
            functionName: 'symbol' as const,
          })),
        })
      : [],
  ]);

  const readMeta = (i: number) => {
    const symbolRes = erc20Meta[i * 2];
    const decimalsRes = erc20Meta[i * 2 + 1];
    return {
      symbol:
        symbolRes?.status === 'success'
          ? String(symbolRes.result)
          : shortAddr(erc20MetaTokens[i].token),
      decimals: decimalsRes?.status === 'success' ? Number(decimalsRes.result) : 18,
    };
  };

  // 4) 组装
  const erc20Result: Erc20Approval[] = liveErc20.map((p, i) => {
    const { symbol, decimals } = readMeta(i);
    const balanceRes = erc20Balances[i];
    const balance =
      balanceRes?.status === 'success' ? (balanceRes.result as bigint) : 0n;
    const atRiskAmountRaw = p.allowance < balance ? p.allowance : balance;
    const unlimited = p.allowance > UNLIMITED_THRESHOLD;
    return {
      kind: 'erc20',
      id: pairKey(p.token, p.spender),
      token: p.token,
      spender: p.spender,
      allowance: p.allowance,
      unlimited,
      symbol,
      decimals,
      amountText: unlimited ? '无限' : formatUnits(p.allowance, decimals),
      atRiskAmountRaw,
      atRiskAmountText: formatUnits(atRiskAmountRaw, decimals),
    };
  });

  const permit2Result: Permit2Approval[] = livePermit2.map((p, i) => {
    const metaIndex = liveErc20.length + i;
    const { symbol, decimals } = readMeta(metaIndex);
    const balanceRes = erc20Balances[metaIndex];
    const balance =
      balanceRes?.status === 'success' ? (balanceRes.result as bigint) : 0n;
    const atRiskAmountRaw = p.amount < balance ? p.amount : balance;
    const unlimited = p.amount > PERMIT2_UNLIMITED_THRESHOLD;
    return {
      kind: 'permit2',
      id: `p2-${pairKey(p.token, p.spender)}`,
      token: p.token,
      spender: p.spender,
      amount: p.amount,
      expiration: p.expiration,
      unlimited,
      symbol,
      decimals,
      amountText: unlimited ? '无限' : formatUnits(p.amount, decimals),
      atRiskAmountRaw,
      atRiskAmountText: formatUnits(atRiskAmountRaw, decimals),
    };
  });

  const nftResult: NftApproval[] = liveNft.map((p, i) => {
    const symbolRes = nftMeta[i];
    return {
      kind: 'nft',
      id: pairKey(p.token, p.spender),
      token: p.token,
      spender: p.spender,
      symbol:
        symbolRes?.status === 'success' ? String(symbolRes.result) : shortAddr(p.token),
    };
  });

  // 高风险（无限 / NFT 全集合）排前面
  return [...erc20Result, ...permit2Result, ...nftResult].sort(
    (a, b) => Number(isRisky(b)) - Number(isRisky(a)),
  );
}
