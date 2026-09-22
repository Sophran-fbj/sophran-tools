import { getAddress, isAddress } from 'viem';

export const SCAM_SNIFFER_SOURCE = {
  id: 'scam-sniffer',
  name: 'Scam Sniffer',
  repositoryUrl: 'https://github.com/scamsniffer/scam-database',
  license: 'GPL-3.0',
  scope: 'evm',
  updateCadence: 'daily',
  publicDelayDays: 7,
} as const;

const FEED_URL =
  'https://raw.githubusercontent.com/scamsniffer/scam-database/main/blacklist/address.json';
const CACHE_TTL_MS = 6 * 60 * 60_000;
const UPSTREAM_TIMEOUT_MS = 8_000;
const MAX_FEED_ENTRIES = 100_000;

export interface ThreatFeedSnapshot {
  addresses: ReadonlySet<string>;
  fetchedAt: number;
  stale: boolean;
}

let cachedSnapshot: ThreatFeedSnapshot | undefined;
let inFlight: Promise<ThreatFeedSnapshot> | undefined;

export function parseThreatAddressFeed(value: unknown): ReadonlySet<string> {
  if (!Array.isArray(value) || value.length > MAX_FEED_ENTRIES) {
    throw new Error('恶意地址情报源返回了无效列表');
  }

  const addresses = new Set<string>();
  for (const item of value) {
    if (typeof item !== 'string' || !isAddress(item)) {
      throw new Error('恶意地址情报源包含无效地址');
    }
    addresses.add(getAddress(item).toLowerCase());
  }
  return addresses;
}

export async function getThreatFeedSnapshot(): Promise<ThreatFeedSnapshot> {
  const now = Date.now();
  if (cachedSnapshot && now - cachedSnapshot.fetchedAt < CACHE_TTL_MS) {
    return cachedSnapshot;
  }
  if (inFlight) return inFlight;

  inFlight = fetch(FEED_URL, {
    cache: 'no-store',
    headers: { Accept: 'application/json' },
    signal: AbortSignal.timeout(UPSTREAM_TIMEOUT_MS),
  })
    .then(async (response) => {
      if (!response.ok) {
        throw new Error(`Scam Sniffer HTTP ${response.status}`);
      }
      const snapshot: ThreatFeedSnapshot = {
        addresses: parseThreatAddressFeed(await response.json()),
        fetchedAt: Date.now(),
        stale: false,
      };
      cachedSnapshot = snapshot;
      return snapshot;
    })
    .catch((error) => {
      if (cachedSnapshot) return { ...cachedSnapshot, stale: true };
      throw error;
    })
    .finally(() => {
      inFlight = undefined;
    });

  return inFlight;
}
