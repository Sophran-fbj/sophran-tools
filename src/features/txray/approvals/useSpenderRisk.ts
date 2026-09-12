'use client';

import { useQuery } from '@tanstack/react-query';
import { usePublicClient } from 'wagmi';
import { type Address, type PublicClient } from 'viem';
import { getSpenderLabel } from './spenderLabels';

export type RiskLevel = 'malicious' | 'eoa' | 'new' | 'unknown' | 'known';

export interface SpenderRisk {
  level: RiskLevel;
  labelName?: string;
  isEoa: boolean;
  createdAt?: number; // unix 秒
  reason: string;
}

// 已知恶意 / drainer 地址（小写）。内容资产：应从公开情报源（scam-sniffer 等）持续补充。
const BLOCKLIST = new Set<string>([
  // '0x....',  // 填入已知 drainer 地址
]);

const NEW_CONTRACT_DAYS = 30;

export function classifySpenderRisk(input: {
  address: Address;
  chainId?: number;
  isEoa: boolean;
  createdAt?: number;
  now: number;
}): SpenderRisk {
  const address = input.address.toLowerCase();
  const label = getSpenderLabel(input.address, input.chainId ?? 1);

  let level: RiskLevel;
  let reason: string;

  if (BLOCKLIST.has(address)) {
    level = 'malicious';
    reason = '已知恶意地址，建议立即撤销';
  } else if (input.isEoa) {
    level = 'eoa';
    reason = '被授权方是普通钱包（无合约代码）——正常 dApp 不会这样，极可能是钓鱼';
  } else if (label?.trusted) {
    level = 'known';
    reason = label.name;
  } else if (
    input.createdAt &&
    input.now - input.createdAt < NEW_CONTRACT_DAYS * 86400
  ) {
    const days = Math.max(0, Math.floor((input.now - input.createdAt) / 86400));
    level = 'new';
    reason = `合约仅 ${days} 天前部署，谨慎对待`;
  } else {
    level = 'unknown';
    reason = '未在已知名单中，请自行核实';
  }

  return {
    level,
    labelName: label?.name,
    isEoa: input.isEoa,
    createdAt: input.createdAt,
    reason,
  };
}

export function useSpenderRisk(spenders: Address[], chainId = 1) {
  const client = usePublicClient({ chainId });
  const key = [...new Set(spenders.map((s) => s.toLowerCase()))].sort().join(',');

  return useQuery<Record<string, SpenderRisk>>({
    queryKey: ['spender-risk', chainId, key],
    enabled: spenders.length > 0 && !!client,
    staleTime: 5 * 60_000,
    queryFn: () => fetchSpenderRisk(client as PublicClient, spenders, chainId),
  });
}

async function fetchSpenderRisk(
  client: PublicClient,
  spenders: Address[],
  chainId: number,
): Promise<Record<string, SpenderRisk>> {
  const unique = [
    ...new Set(spenders.map((s) => s.toLowerCase())),
  ] as Address[];

  // 1) EOA 检测：有没有合约代码（eth_getCode）
  const codes: Array<`0x${string}` | undefined> = [];
  for (let index = 0; index < unique.length; index += 20) {
    const chunk = unique.slice(index, index + 20);
    codes.push(
      ...(await Promise.all(
        chunk.map((address) =>
          client.getCode({ address }).catch(() => undefined),
        ),
      )),
    );
  }
  const isEoa: Record<string, boolean> = {};
  unique.forEach((a, i) => {
    isEoa[a] = !codes[i] || codes[i] === '0x';
  });

  // 2) 合约部署时间（服务端 Etherscan）
  const createdMap: Record<string, number | null> = {};
  for (let index = 0; index < unique.length; index += 25) {
    const chunk = unique.slice(index, index + 25);
    try {
      const response = await fetch(
        `/api/spender-info?chainId=${chainId}&addresses=${chunk.join(',')}`,
      );
      if (!response.ok) continue;
      const json: unknown = await response.json();
      if (!json || typeof json !== 'object') continue;
      const created = (json as Record<string, unknown>).created;
      if (created && typeof created === 'object' && !Array.isArray(created)) {
        for (const [address, timestamp] of Object.entries(created)) {
          if (timestamp === null || typeof timestamp === 'number') {
            createdMap[address] = timestamp;
          }
        }
      }
    } catch {
      // Deployment age is an optional signal; code presence remains authoritative.
    }
  }

  // 3) 综合风险
  const now = Math.floor(Date.now() / 1000);
  const out: Record<string, SpenderRisk> = {};
  for (const a of unique) {
    const eoa = isEoa[a];
    const createdAt = createdMap[a] ?? undefined;
    out[a] = classifySpenderRisk({
      address: a,
      chainId,
      isEoa: eoa,
      createdAt,
      now,
    });
  }
  return out;
}
