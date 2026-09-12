import { NextResponse, type NextRequest } from 'next/server';
import { getAddress, isAddress, toEventSelector } from 'viem';
import {
  PERMIT2_ADDRESS,
  PERMIT2_APPROVAL_EVENT,
  PERMIT2_PERMIT_EVENT,
} from '@/features/txray/approvals/permit2';
import { isSupportedTxRayChain } from '@/features/txray/chains/chains';
import {
  checkRateLimit,
  requestClientKey,
  scheduleExternalRequest,
} from '@/lib/server/requestGuard';
import { isRecord } from '@/lib/validation';

const APPROVAL_TOPIC0 =
  '0x8c5be1e5ebec7d5bd14f71427d1e84f3dd0314c0f7b2291e5b200ac8c7c3b925';
const APPROVAL_FOR_ALL_TOPIC0 =
  '0x17307eab39ab6107e8899845ad3d59bd9653f200f220920489ca2b5937696c31';
const PERMIT2_APPROVAL_TOPIC0 = toEventSelector(PERMIT2_APPROVAL_EVENT);
const PERMIT2_PERMIT_TOPIC0 = toEventSelector(PERMIT2_PERMIT_EVENT);

const ETHERSCAN_BASE = 'https://api.etherscan.io/v2/api';
const PAGE_SIZE = 1000;
const MAX_PAGES_PER_SOURCE = 10;
const UPSTREAM_TIMEOUT_MS = 12_000;
const CACHE_TTL_MS = 60_000;
const MAX_CACHE_ENTRIES = 2_000;

interface EtherscanLog {
  address: string;
  topics: string[];
}

interface Pair {
  token: string;
  spender: string;
}

interface LogPageResult {
  logs: EtherscanLog[];
  truncated: boolean;
}

interface ApprovalIndexResponse {
  erc20: Pair[];
  nft: Pair[];
  permit2: Pair[];
  coverage: {
    status: 'complete' | 'partial';
    truncatedSources: string[];
    maxRecordsPerSource: number;
  };
}

const responseCache = new Map<
  string,
  { expiresAt: number; value: ApprovalIndexResponse }
>();
const inFlight = new Map<string, Promise<ApprovalIndexResponse>>();

function cacheResponse(key: string, value: ApprovalIndexResponse): void {
  const now = Date.now();
  if (responseCache.size >= MAX_CACHE_ENTRIES) {
    for (const [cachedKey, cached] of responseCache) {
      if (cached.expiresAt <= now) responseCache.delete(cachedKey);
    }
  }
  while (responseCache.size >= MAX_CACHE_ENTRIES) {
    const oldestKey = responseCache.keys().next().value;
    if (typeof oldestKey !== 'string') break;
    responseCache.delete(oldestKey);
  }
  responseCache.set(key, { expiresAt: now + CACHE_TTL_MS, value });
}

function topicToAddress(topic: string): string {
  return getAddress(`0x${topic.slice(-40)}`);
}

function isEtherscanLog(value: unknown): value is EtherscanLog {
  if (!isRecord(value)) return false;
  const log = value;
  return (
    typeof log.address === 'string' &&
    isAddress(log.address) &&
    Array.isArray(log.topics) &&
    log.topics.every((topic) => typeof topic === 'string')
  );
}

function upstreamMessage(value: unknown): string {
  if (!isRecord(value)) return '';
  const json = value;
  if (typeof json.result === 'string') return json.result;
  return typeof json.message === 'string' ? json.message : '';
}

async function fetchLogPage(url: URL): Promise<EtherscanLog[]> {
  const response = await scheduleExternalRequest(() =>
    fetch(url, {
      cache: 'no-store',
      signal: AbortSignal.timeout(UPSTREAM_TIMEOUT_MS),
    }),
  );
  if (!response.ok) throw new Error(`Etherscan HTTP ${response.status}`);

  const json: unknown = await response.json();
  if (isRecord(json)) {
    const result = json.result;
    if (Array.isArray(result)) {
      if (!result.every(isEtherscanLog)) {
        throw new Error('Etherscan 返回了无效日志数据');
      }
      return result;
    }
  }

  const message = upstreamMessage(json);
  if (/no records found/i.test(message)) return [];
  throw new Error(message || 'Etherscan 查询失败');
}

async function fetchAllLogs(
  chainId: number,
  topic0: string,
  ownerTopic: string,
  apiKey: string,
  contractAddress?: string,
): Promise<LogPageResult> {
  const logs: EtherscanLog[] = [];

  for (let page = 1; page <= MAX_PAGES_PER_SOURCE; page += 1) {
    const url = new URL(ETHERSCAN_BASE);
    url.searchParams.set('chainid', String(chainId));
    url.searchParams.set('module', 'logs');
    url.searchParams.set('action', 'getLogs');
    if (contractAddress) url.searchParams.set('address', contractAddress);
    url.searchParams.set('topic0', topic0);
    url.searchParams.set('topic1', ownerTopic);
    url.searchParams.set('topic0_1_opr', 'and');
    url.searchParams.set('fromBlock', '0');
    url.searchParams.set('toBlock', 'latest');
    url.searchParams.set('page', String(page));
    url.searchParams.set('offset', String(PAGE_SIZE));
    url.searchParams.set('apikey', apiKey);

    const pageLogs = await fetchLogPage(url);
    logs.push(...pageLogs);
    if (pageLogs.length < PAGE_SIZE) return { logs, truncated: false };
  }

  return { logs, truncated: true };
}

function dedupeSpenderPairs(logs: EtherscanLog[]): Pair[] {
  const pairs = new Map<string, Pair>();
  for (const log of logs) {
    const spenderTopic = log.topics[2];
    if (!spenderTopic) continue;
    try {
      const token = getAddress(log.address);
      const spender = topicToAddress(spenderTopic);
      pairs.set(`${token.toLowerCase()}-${spender.toLowerCase()}`, { token, spender });
    } catch {
      // Ignore malformed individual logs, while retaining all valid results.
    }
  }
  return [...pairs.values()];
}

function dedupePermit2Pairs(logs: EtherscanLog[]): Pair[] {
  const pairs = new Map<string, Pair>();
  for (const log of logs) {
    const tokenTopic = log.topics[2];
    const spenderTopic = log.topics[3];
    if (!tokenTopic || !spenderTopic) continue;
    try {
      const token = topicToAddress(tokenTopic);
      const spender = topicToAddress(spenderTopic);
      pairs.set(`${token.toLowerCase()}-${spender.toLowerCase()}`, { token, spender });
    } catch {
      // Ignore malformed individual logs, while retaining all valid results.
    }
  }
  return [...pairs.values()];
}

async function scanApprovals(
  owner: string,
  chainId: number,
  apiKey: string,
): Promise<ApprovalIndexResponse> {
  const ownerTopic = `0x${owner.slice(2).toLowerCase().padStart(64, '0')}`;
  const sources = [
    ['erc20', APPROVAL_TOPIC0, undefined],
    ['nft', APPROVAL_FOR_ALL_TOPIC0, undefined],
    ['permit2Approval', PERMIT2_APPROVAL_TOPIC0, PERMIT2_ADDRESS],
    ['permit2Permit', PERMIT2_PERMIT_TOPIC0, PERMIT2_ADDRESS],
  ] as const;

  const results: Record<(typeof sources)[number][0], LogPageResult> = {
    erc20: { logs: [], truncated: false },
    nft: { logs: [], truncated: false },
    permit2Approval: { logs: [], truncated: false },
    permit2Permit: { logs: [], truncated: false },
  };

  // Sequential requests avoid bursting through Etherscan's per-key rate limit.
  for (const [name, topic, contract] of sources) {
    results[name] = await fetchAllLogs(chainId, topic, ownerTopic, apiKey, contract);
  }

  const truncatedSources = sources
    .filter(([name]) => results[name].truncated)
    .map(([name]) => name);

  return {
    erc20: dedupeSpenderPairs(results.erc20.logs),
    nft: dedupeSpenderPairs(results.nft.logs),
    permit2: dedupePermit2Pairs([
      ...results.permit2Approval.logs,
      ...results.permit2Permit.logs,
    ]),
    coverage: {
      status: truncatedSources.length ? 'partial' : 'complete',
      truncatedSources,
      maxRecordsPerSource: PAGE_SIZE * MAX_PAGES_PER_SOURCE,
    },
  };
}

export async function GET(request: NextRequest) {
  const rateLimit = checkRateLimit(
    `approvals:${requestClientKey(request.headers)}`,
    8,
    60_000,
  );
  if (!rateLimit.allowed) {
    return NextResponse.json(
      { error: { code: 'RATE_LIMITED', message: '请求过于频繁，请稍后重试' } },
      {
        status: 429,
        headers: { 'Retry-After': String(rateLimit.retryAfterSeconds) },
      },
    );
  }

  const ownerParam = request.nextUrl.searchParams.get('owner');
  const chainId = Number(request.nextUrl.searchParams.get('chainId') ?? '1');
  if (!isSupportedTxRayChain(chainId)) {
    return NextResponse.json(
      { error: { code: 'UNSUPPORTED_CHAIN', message: '暂不支持该链' } },
      { status: 400 },
    );
  }
  if (!ownerParam || !isAddress(ownerParam)) {
    return NextResponse.json(
      { error: { code: 'INVALID_ADDRESS', message: '无效地址' } },
      { status: 400 },
    );
  }

  const apiKey = process.env.ETHERSCAN_API_KEY;
  if (!apiKey) {
    return NextResponse.json(
      { error: { code: 'CONFIG_MISSING', message: '服务端未配置 Etherscan API key' } },
      { status: 503 },
    );
  }

  const owner = getAddress(ownerParam);
  const cacheKey = `${chainId}:${owner.toLowerCase()}`;
  const cached = responseCache.get(cacheKey);
  if (cached && cached.expiresAt > Date.now()) {
    return NextResponse.json(cached.value, {
      headers: { 'Cache-Control': 'public, max-age=30, s-maxage=60' },
    });
  }

  try {
    let pending = inFlight.get(cacheKey);
    if (!pending) {
      pending = scanApprovals(owner, chainId, apiKey);
      inFlight.set(cacheKey, pending);
    }
    const value = await pending;
    cacheResponse(cacheKey, value);
    return NextResponse.json(value, {
      headers: { 'Cache-Control': 'public, max-age=30, s-maxage=60' },
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : '上游查询失败';
    console.error('[approvals] upstream scan failed', { chainId, owner, message });
    return NextResponse.json(
      { error: { code: 'UPSTREAM_FAILED', message: '授权索引服务暂时不可用，请稍后重试' } },
      { status: 502 },
    );
  } finally {
    inFlight.delete(cacheKey);
  }
}
