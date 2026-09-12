'use client';

import { useQuery } from '@tanstack/react-query';
import { usePublicClient } from 'wagmi';
import { getAddress, type Address, type PublicClient } from 'viem';
import { getSpenderLabel } from './spenderLabels';
import { isRecord } from '@/lib/validation';

export type RiskLevel = 'malicious' | 'eoa' | 'new' | 'unknown' | 'known';

export interface SpenderRisk {
  level: RiskLevel;
  labelName?: string;
  isEoa?: boolean;
  codeVerified: boolean;
  createdAt?: number;
  reason: string;
}

// Intentionally empty until a maintained, attributable threat feed is integrated.
const BLOCKLIST = new Set<string>();
const NEW_CONTRACT_DAYS = 30;

export function classifySpenderRisk(input: {
  address: Address;
  chainId?: number;
  isEoa?: boolean;
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
  } else if (input.isEoa === true) {
    level = 'eoa';
    reason = '被授权方是普通钱包（无合约代码）——正常 dApp 不会这样，极可能是钓鱼';
  } else if (label?.trusted) {
    level = 'known';
    reason = label.name;
  } else if (input.isEoa === undefined) {
    level = 'unknown';
    reason = 'RPC 未能验证该地址是否为合约，请稍后重试';
  } else if (
    input.createdAt !== undefined &&
    input.now - input.createdAt < NEW_CONTRACT_DAYS * 86_400
  ) {
    const days = Math.max(
      0,
      Math.floor((input.now - input.createdAt) / 86_400),
    );
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
    codeVerified: input.isEoa !== undefined,
    createdAt: input.createdAt,
    reason,
  };
}

export function useSpenderRisk(spenders: Address[], chainId = 1) {
  const client = usePublicClient({ chainId });
  const key = [...new Set(spenders.map((spender) => spender.toLowerCase()))]
    .sort()
    .join(',');

  return useQuery<Record<string, SpenderRisk>>({
    queryKey: ['spender-risk', chainId, key],
    enabled: spenders.length > 0 && Boolean(client),
    staleTime: 5 * 60_000,
    queryFn: async () => {
      if (!client) throw new Error('目标链 RPC 不可用');
      return fetchSpenderRisk(client, spenders, chainId);
    },
  });
}

async function fetchSpenderRisk(
  client: PublicClient,
  spenders: Address[],
  chainId: number,
): Promise<Record<string, SpenderRisk>> {
  const unique = [
    ...new Map(
      spenders.map((spender) => [spender.toLowerCase(), getAddress(spender)]),
    ).values(),
  ];

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

  const eoaByAddress: Record<string, boolean | undefined> = {};
  unique.forEach((address, index) => {
    const code = codes[index];
    eoaByAddress[address.toLowerCase()] =
      code === undefined ? undefined : code === '0x';
  });

  const createdMap: Record<string, number | null> = {};
  for (let index = 0; index < unique.length; index += 25) {
    const chunk = unique.slice(index, index + 25);
    try {
      const response = await fetch(
        `/api/spender-info?chainId=${chainId}&addresses=${chunk.join(',')}`,
      );
      if (!response.ok) continue;
      const json: unknown = await response.json();
      Object.assign(createdMap, parseSpenderInfoPayload(json));
    } catch {
      // Deployment age is optional; code verification is tracked separately.
    }
  }

  const now = Math.floor(Date.now() / 1000);
  const result: Record<string, SpenderRisk> = {};
  for (const address of unique) {
    const key = address.toLowerCase();
    result[key] = classifySpenderRisk({
      address,
      chainId,
      isEoa: eoaByAddress[key],
      createdAt: createdMap[key] ?? undefined,
      now,
    });
  }
  return result;
}

export function parseSpenderInfoPayload(
  value: unknown,
): Record<string, number | null> {
  if (!isRecord(value) || !isRecord(value.created)) return {};

  const result: Record<string, number | null> = {};
  for (const [address, timestamp] of Object.entries(value.created)) {
    if (
      timestamp === null ||
      (typeof timestamp === 'number' &&
        Number.isSafeInteger(timestamp) &&
        timestamp >= 0)
    ) {
      result[address.toLowerCase()] = timestamp;
    }
  }
  return result;
}
