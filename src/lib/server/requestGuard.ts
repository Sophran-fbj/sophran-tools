import {
  reserveSharedRequestSlot,
  sharedRateLimit,
} from './sharedState';

interface RateLimitBucket {
  count: number;
  resetAt: number;
}

const buckets = new Map<string, RateLimitBucket>();
let externalRequestQueue: Promise<void> = Promise.resolve();
let nextExternalRequestAt = 0;

export interface RateLimitResult {
  allowed: boolean;
  retryAfterSeconds: number;
  backend: 'shared' | 'memory';
}

let lastFallbackWarningAt = 0;

function warnSharedFallback(operation: string, error: unknown): void {
  const now = Date.now();
  if (now - lastFallbackWarningAt < 60_000) return;
  lastFallbackWarningAt = now;
  console.warn('[request-guard] shared state unavailable; using memory fallback', {
    operation,
    message: error instanceof Error ? error.message : 'not configured',
  });
}

export async function checkRateLimit(
  key: string,
  limit: number,
  windowMs: number,
): Promise<RateLimitResult> {
  try {
    const shared = await sharedRateLimit(key, limit, windowMs);
    if (shared) {
      return {
        allowed: shared.count <= limit,
        retryAfterSeconds: shared.retryAfterSeconds,
        backend: 'shared',
      };
    }
  } catch (error) {
    warnSharedFallback('rate-limit', error);
  }

  const now = Date.now();
  if (buckets.size > 10_000) {
    for (const [bucketKey, bucket] of buckets) {
      if (bucket.resetAt <= now) buckets.delete(bucketKey);
    }
    while (buckets.size > 10_000) {
      const oldestKey = buckets.keys().next().value;
      if (typeof oldestKey !== 'string') break;
      buckets.delete(oldestKey);
    }
  }
  const current = buckets.get(key);

  if (!current || current.resetAt <= now) {
    buckets.set(key, { count: 1, resetAt: now + windowMs });
    return { allowed: true, retryAfterSeconds: 0, backend: 'memory' };
  }

  if (current.count >= limit) {
    return {
      allowed: false,
      retryAfterSeconds: Math.max(1, Math.ceil((current.resetAt - now) / 1000)),
      backend: 'memory',
    };
  }

  current.count += 1;
  return { allowed: true, retryAfterSeconds: 0, backend: 'memory' };
}

export function scheduleExternalRequest<T>(
  task: () => Promise<T>,
  minimumIntervalMs = 350,
): Promise<T> {
  const run = externalRequestQueue.then(async () => {
    let delayMs: number | undefined;
    try {
      delayMs = await reserveSharedRequestSlot(
        'etherscan-v2',
        minimumIntervalMs,
      );
    } catch (error) {
      warnSharedFallback('external-request-queue', error);
    }
    if (delayMs === undefined) {
      delayMs = Math.max(0, nextExternalRequestAt - Date.now());
      nextExternalRequestAt = Date.now() + delayMs + minimumIntervalMs;
    }
    if (delayMs > 0) {
      await new Promise((resolve) => setTimeout(resolve, delayMs));
    }
    return task();
  });
  externalRequestQueue = run.then(
    () => undefined,
    () => undefined,
  );
  return run;
}

export function requestClientKey(headers: Headers): string {
  const forwarded = headers.get('x-forwarded-for')?.split(',')[0]?.trim();
  const realIp = headers.get('x-real-ip')?.trim();
  return forwarded || realIp || 'unknown';
}
