import { createHmac } from 'node:crypto';
import { isRecord } from '@/lib/validation';

const REQUEST_TIMEOUT_MS = 1_500;
const KEY_PREFIX = 'txray:v1';

interface RedisRestConfig {
  url: string;
  token: string;
}

export interface SharedCacheLookup {
  status: 'hit' | 'miss' | 'unavailable';
  value?: unknown;
}

function redisConfig(): RedisRestConfig | undefined {
  const url = (
    process.env.UPSTASH_REDIS_REST_URL ?? process.env.KV_REST_API_URL
  )?.replace(/\/+$/, '');
  const token =
    process.env.UPSTASH_REDIS_REST_TOKEN ?? process.env.KV_REST_API_TOKEN;
  if (!url || !token) return undefined;
  try {
    const parsed = new URL(url);
    if (parsed.protocol !== 'https:') return undefined;
  } catch {
    return undefined;
  }
  return { url, token };
}

function redisKey(config: RedisRestConfig, namespace: string, rawKey: string) {
  const digest = createHmac('sha256', config.token)
    .update(`${namespace}:${rawKey}`)
    .digest('hex');
  return `${KEY_PREFIX}:${namespace}:${digest}`;
}

async function redisCommand(
  config: RedisRestConfig,
  command: Array<string | number>,
): Promise<unknown> {
  const response = await fetch(config.url, {
    method: 'POST',
    headers: {
      Authorization: `Bearer ${config.token}`,
      'Content-Type': 'application/json',
    },
    body: JSON.stringify(command),
    signal: AbortSignal.timeout(REQUEST_TIMEOUT_MS),
  });
  if (!response.ok) throw new Error(`shared state HTTP ${response.status}`);
  const payload: unknown = await response.json();
  if (!isRecord(payload) || 'error' in payload || !('result' in payload)) {
    throw new Error('shared state returned an invalid response');
  }
  return payload.result;
}

export async function sharedRateLimit(
  rawKey: string,
  limit: number,
  windowMs: number,
): Promise<{ count: number; retryAfterSeconds: number } | undefined> {
  const config = redisConfig();
  if (!config) return undefined;
  const key = redisKey(config, 'rate', rawKey);
  const script = [
    "local count = redis.call('INCR', KEYS[1])",
    "if count == 1 then redis.call('PEXPIRE', KEYS[1], ARGV[1]) end",
    "local ttl = redis.call('PTTL', KEYS[1])",
    "if ttl < 0 then redis.call('PEXPIRE', KEYS[1], ARGV[1]); ttl = tonumber(ARGV[1]) end",
    'return {count, ttl}',
  ].join('\n');
  const result = await redisCommand(config, [
    'EVAL',
    script,
    1,
    key,
    windowMs,
  ]);
  if (
    !Array.isArray(result) ||
    typeof result[0] !== 'number' ||
    typeof result[1] !== 'number'
  ) {
    throw new Error('shared rate limit returned an invalid response');
  }
  return {
    count: result[0],
    retryAfterSeconds:
      result[0] > limit ? Math.max(1, Math.ceil(result[1] / 1000)) : 0,
  };
}

export async function reserveSharedRequestSlot(
  scope: string,
  minimumIntervalMs: number,
): Promise<number | undefined> {
  const config = redisConfig();
  if (!config) return undefined;
  const key = redisKey(config, 'queue', scope);
  const now = Date.now();
  const script = [
    "local previous = tonumber(redis.call('GET', KEYS[1]) or ARGV[1])",
    'local now = tonumber(ARGV[1])',
    'local interval = tonumber(ARGV[2])',
    'local slot = math.max(previous, now)',
    "redis.call('SET', KEYS[1], slot + interval, 'PX', math.max(60000, interval * 10))",
    'return slot - now',
  ].join('\n');
  const result = await redisCommand(config, [
    'EVAL',
    script,
    1,
    key,
    now,
    minimumIntervalMs,
  ]);
  if (typeof result !== 'number' || !Number.isFinite(result)) {
    throw new Error('shared request queue returned an invalid response');
  }
  return Math.max(0, result);
}

export async function getSharedJson(
  namespace: string,
  rawKey: string,
): Promise<SharedCacheLookup> {
  const config = redisConfig();
  if (!config) return { status: 'unavailable' };
  const result = await redisCommand(
    config,
    ['GET', redisKey(config, namespace, rawKey)],
  );
  if (result === null) return { status: 'miss' };
  if (typeof result !== 'string') {
    throw new Error('shared cache returned a non-string value');
  }
  return { status: 'hit', value: JSON.parse(result) as unknown };
}

export async function setSharedJson(
  namespace: string,
  rawKey: string,
  value: unknown,
  ttlSeconds: number,
): Promise<boolean> {
  const config = redisConfig();
  if (!config) return false;
  const result = await redisCommand(config, [
    'SET',
    redisKey(config, namespace, rawKey),
    JSON.stringify(value),
    'EX',
    ttlSeconds,
  ]);
  return result === 'OK';
}
