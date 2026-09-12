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
}

export function checkRateLimit(
  key: string,
  limit: number,
  windowMs: number,
): RateLimitResult {
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
    return { allowed: true, retryAfterSeconds: 0 };
  }

  if (current.count >= limit) {
    return {
      allowed: false,
      retryAfterSeconds: Math.max(1, Math.ceil((current.resetAt - now) / 1000)),
    };
  }

  current.count += 1;
  return { allowed: true, retryAfterSeconds: 0 };
}

export function scheduleExternalRequest<T>(
  task: () => Promise<T>,
  minimumIntervalMs = 350,
): Promise<T> {
  const run = externalRequestQueue.then(async () => {
    const delayMs = Math.max(0, nextExternalRequestAt - Date.now());
    if (delayMs > 0) {
      await new Promise((resolve) => setTimeout(resolve, delayMs));
    }
    nextExternalRequestAt = Date.now() + minimumIntervalMs;
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
