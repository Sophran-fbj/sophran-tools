import { NextResponse, type NextRequest } from 'next/server';
import { getAddress, isAddress } from 'viem';
import { isSupportedTxRayChain } from '@/features/txray/chains/chains';
import {
  checkRateLimit,
  requestClientKey,
  scheduleExternalRequest,
} from '@/lib/server/requestGuard';
import { isRecord } from '@/lib/validation';
import {
  getThreatFeedSnapshot,
  SCAM_SNIFFER_SOURCE,
} from '@/lib/server/threatIntelligence';

const ETHERSCAN_BASE = 'https://api.etherscan.io/v2/api';
const MAX_ADDRESSES = 25;
const UPSTREAM_TIMEOUT_MS = 10_000;

interface ContractCreation {
  contractAddress: string;
  timestamp?: string;
}

function isContractCreation(value: unknown): value is ContractCreation {
  if (!isRecord(value)) return false;
  const item = value;
  return (
    typeof item.contractAddress === 'string' &&
    isAddress(item.contractAddress) &&
    (item.timestamp === undefined ||
      (typeof item.timestamp === 'string' && /^\d+$/.test(item.timestamp)))
  );
}

export async function GET(request: NextRequest) {
  const rateLimit = await checkRateLimit(
    `spender-info:${requestClientKey(request.headers)}`,
    20,
    60_000,
  );
  if (!rateLimit.allowed) {
    return NextResponse.json(
      { error: { code: 'RATE_LIMITED', message: '请求过于频繁，请稍后重试' } },
      {
        status: 429,
        headers: {
          'Retry-After': String(rateLimit.retryAfterSeconds),
          'X-TxRay-Guard': rateLimit.backend,
        },
      },
    );
  }

  const chainId = Number(request.nextUrl.searchParams.get('chainId') ?? '1');
  if (!isSupportedTxRayChain(chainId)) {
    return NextResponse.json(
      { error: { code: 'UNSUPPORTED_CHAIN', message: '暂不支持该链' } },
      { status: 400 },
    );
  }

  const raw = request.nextUrl.searchParams.get('addresses') ?? '';
  const requested = raw.split(',').map((address) => address.trim()).filter(Boolean);
  if (requested.length > MAX_ADDRESSES) {
    return NextResponse.json(
      { error: { code: 'TOO_MANY_ADDRESSES', message: `一次最多查询 ${MAX_ADDRESSES} 个地址` } },
      { status: 400 },
    );
  }

  const addresses = [
    ...new Set(
      requested
        .filter((address): address is `0x${string}` => isAddress(address))
        .map((address) => getAddress(address)),
    ),
  ];
  if (addresses.length !== requested.length) {
    return NextResponse.json(
      { error: { code: 'INVALID_ADDRESS', message: '地址列表包含无效地址' } },
      { status: 400 },
    );
  }
  if (!addresses.length) return NextResponse.json({ created: {}, complete: true });

  const created: Record<string, number | null> = {};
  let creationComplete = true;
  const apiKey = process.env.ETHERSCAN_API_KEY;
  const threatSnapshotPromise = getThreatFeedSnapshot();

  for (let index = 0; apiKey && index < addresses.length; index += 5) {
    const chunk = addresses.slice(index, index + 5);
    const url = new URL(ETHERSCAN_BASE);
    url.searchParams.set('chainid', String(chainId));
    url.searchParams.set('module', 'contract');
    url.searchParams.set('action', 'getcontractcreation');
    url.searchParams.set('contractaddresses', chunk.join(','));
    url.searchParams.set('apikey', apiKey);

    try {
      const response = await scheduleExternalRequest(() =>
        fetch(url, {
          cache: 'no-store',
          signal: AbortSignal.timeout(UPSTREAM_TIMEOUT_MS),
        }),
      );
      if (!response.ok) throw new Error(`Etherscan HTTP ${response.status}`);
      const json: unknown = await response.json();
      const result = isRecord(json) ? json.result : undefined;
      if (!Array.isArray(result) || !result.every(isContractCreation)) {
        throw new Error('Etherscan 返回了无效合约创建数据');
      }
      for (const item of result) {
        const address = getAddress(item.contractAddress).toLowerCase();
        const timestamp = item.timestamp ? Number(item.timestamp) : undefined;
        created[address] =
          timestamp !== undefined && Number.isSafeInteger(timestamp)
            ? timestamp
            : null;
      }
    } catch (error) {
      creationComplete = false;
      console.error('[spender-info] upstream request failed', {
        chainId,
        count: chunk.length,
        message: error instanceof Error ? error.message : 'unknown error',
      });
    }
  }

  if (!apiKey) creationComplete = false;

  let threat:
    | {
        status: 'available';
        malicious: string[];
        checkedAt: number;
        stale: boolean;
        source: typeof SCAM_SNIFFER_SOURCE;
      }
    | {
        status: 'unavailable';
        malicious: string[];
        checkedAt: null;
        stale: false;
        source: typeof SCAM_SNIFFER_SOURCE;
  };

  try {
    const snapshot = await threatSnapshotPromise;
    threat = {
      status: 'available',
      malicious: addresses.filter((address) =>
        snapshot.addresses.has(address.toLowerCase()),
      ),
      checkedAt: snapshot.fetchedAt,
      stale: snapshot.stale,
      source: SCAM_SNIFFER_SOURCE,
    };
  } catch (error) {
    console.error('[spender-info] threat feed request failed', {
      chainId,
      message: error instanceof Error ? error.message : 'unknown error',
    });
    threat = {
      status: 'unavailable',
      malicious: [],
      checkedAt: null,
      stale: false,
      source: SCAM_SNIFFER_SOURCE,
    };
  }

  return NextResponse.json(
    {
      created,
      complete: creationComplete,
      creationComplete,
      threat,
    },
    {
      headers: {
        'Cache-Control': 'public, max-age=300, s-maxage=3600',
        'X-TxRay-Guard': rateLimit.backend,
      },
    },
  );
}
