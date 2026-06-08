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

// 超过这个量级即视为「无限授权」
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
}

export interface NftApproval {
  kind: 'nft';
  id: string;
  token: Address;
  spender: Address;
  symbol: string;
}

export type Approval = Erc20Approval | NftApproval;

interface Pair {
  token: Address;
  spender: Address;
}

const pairKey = (token: Address, spender: Address) =>
  `${token.toLowerCase()}-${spender.toLowerCase()}`;

const shortAddr = (addr: string) => `${addr.slice(0, 6)}…${addr.slice(-4)}`;

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
  // 1) 历史授权对来自服务端（Etherscan getLogs，绕开 Alchemy 免费版 10 区块限制）
  const res = await fetch(`/api/approvals?owner=${owner}&chainId=${chainId}`);
  const json = await res.json();
  if (!res.ok) throw new Error(json.error ?? '获取授权记录失败');
  const erc20Pairs = json.erc20 as Pair[];
  const nftPairs = json.nft as Pair[];

  // 2) multicall 校验「当前」额度 / 授权状态（eth_call，不受 getLogs 限制）
  const [allowances, nftApproved] = await Promise.all([
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
    return r?.status === 'success' && r.result === true;
  });

  // 3) multicall 读元数据
  const [erc20Meta, nftMeta] = await Promise.all([
    liveErc20.length
      ? client.multicall({
          allowFailure: true,
          contracts: liveErc20.flatMap((p) => [
            { address: p.token, abi: erc20Abi, functionName: 'symbol' } as const,
            { address: p.token, abi: erc20Abi, functionName: 'decimals' } as const,
          ]),
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

  // 4) 组装
  const erc20Result: Erc20Approval[] = liveErc20.map((p, i) => {
    const symbolRes = erc20Meta[i * 2];
    const decimalsRes = erc20Meta[i * 2 + 1];
    const symbol =
      symbolRes?.status === 'success' ? String(symbolRes.result) : shortAddr(p.token);
    const decimals =
      decimalsRes?.status === 'success' ? Number(decimalsRes.result) : 18;
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

  // 无限授权排前面，更显眼
  return [...erc20Result, ...nftResult].sort(
    (a, b) =>
      Number(b.kind === 'erc20' && b.unlimited) -
      Number(a.kind === 'erc20' && a.unlimited),
  );
}
