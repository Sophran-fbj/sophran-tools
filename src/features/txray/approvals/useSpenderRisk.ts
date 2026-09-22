'use client';

import { useQuery } from '@tanstack/react-query';
import { usePublicClient } from 'wagmi';
import { getAddress, isAddress, type Address, type PublicClient } from 'viem';
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
  threat: ThreatIntelligenceStatus;
}

export interface ThreatIntelligenceStatus {
  status: 'available' | 'unavailable';
  sourceName: string;
  sourceUrl: string;
  publicDelayDays: number;
  checkedAt?: number;
  stale?: boolean;
}

interface SpenderInfoPayload {
  created: Record<string, number | null>;
  malicious: Set<string>;
  threat: ThreatIntelligenceStatus;
}

const DEFAULT_THREAT_STATUS: ThreatIntelligenceStatus = {
  status: 'unavailable',
  sourceName: 'Scam Sniffer',
  sourceUrl: 'https://github.com/scamsniffer/scam-database',
  publicDelayDays: 7,
};
const NEW_CONTRACT_DAYS = 30;

export function classifySpenderRisk(input: {
  address: Address;
  chainId?: number;
  isEoa?: boolean;
  createdAt?: number;
  malicious?: boolean;
  threat?: ThreatIntelligenceStatus;
  now: number;
}): SpenderRisk {
  const label = getSpenderLabel(input.address, input.chainId ?? 1);

  let level: RiskLevel;
  let reason: string;

  if (input.malicious) {
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
    threat: input.threat ?? DEFAULT_THREAT_STATUS,
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
  const malicious = new Set<string>();
  let threat = DEFAULT_THREAT_STATUS;
  for (let index = 0; index < unique.length; index += 25) {
    const chunk = unique.slice(index, index + 25);
    try {
      const response = await fetch(
        `/api/spender-info?chainId=${chainId}&addresses=${chunk.join(',')}`,
      );
      if (!response.ok) continue;
      const json: unknown = await response.json();
      const parsed = parseSpenderInfoPayload(json);
      Object.assign(createdMap, parsed.created);
      parsed.malicious.forEach((address) => malicious.add(address));
      if (parsed.threat.status === 'available') threat = parsed.threat;
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
      malicious: malicious.has(key),
      threat,
      now,
    });
  }
  return result;
}

export function parseSpenderInfoPayload(
  value: unknown,
): SpenderInfoPayload {
  const fallback: SpenderInfoPayload = {
    created: {},
    malicious: new Set(),
    threat: DEFAULT_THREAT_STATUS,
  };
  if (!isRecord(value) || !isRecord(value.created)) return fallback;

  const created: Record<string, number | null> = {};
  for (const [address, timestamp] of Object.entries(value.created)) {
    if (
      timestamp === null ||
      (typeof timestamp === 'number' &&
        Number.isSafeInteger(timestamp) &&
        timestamp >= 0)
    ) {
      created[address.toLowerCase()] = timestamp;
    }
  }

  const threatValue = value.threat;
  if (!isRecord(threatValue)) {
    return { ...fallback, created };
  }
  const source = threatValue.source;
  if (!isRecord(source)) return { ...fallback, created };
  const maliciousValues = threatValue.malicious;
  const status = threatValue.status;
  if (
    (status !== 'available' && status !== 'unavailable') ||
    !Array.isArray(maliciousValues) ||
    !maliciousValues.every(
      (address) => typeof address === 'string' && isAddress(address),
    ) ||
    typeof source.name !== 'string' ||
    typeof source.repositoryUrl !== 'string' ||
    typeof source.publicDelayDays !== 'number' ||
    source.name !== 'Scam Sniffer' ||
    source.repositoryUrl !== 'https://github.com/scamsniffer/scam-database'
  ) {
    return { ...fallback, created };
  }

  const checkedAt = threatValue.checkedAt;
  return {
    created,
    malicious: new Set(
      maliciousValues.map((address) => getAddress(address).toLowerCase()),
    ),
    threat: {
      status,
      sourceName: source.name,
      sourceUrl: source.repositoryUrl,
      publicDelayDays: source.publicDelayDays,
      checkedAt:
        typeof checkedAt === 'number' && Number.isSafeInteger(checkedAt)
          ? checkedAt
          : undefined,
      stale: threatValue.stale === true,
    },
  };
}
