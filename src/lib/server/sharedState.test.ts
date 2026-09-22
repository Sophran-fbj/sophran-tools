import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  getSharedJson,
  reserveSharedRequestSlot,
  setSharedJson,
  sharedRateLimit,
} from './sharedState';

const originalUrl = process.env.UPSTASH_REDIS_REST_URL;
const originalToken = process.env.UPSTASH_REDIS_REST_TOKEN;

afterEach(() => {
  vi.unstubAllGlobals();
  if (originalUrl === undefined) delete process.env.UPSTASH_REDIS_REST_URL;
  else process.env.UPSTASH_REDIS_REST_URL = originalUrl;
  if (originalToken === undefined) delete process.env.UPSTASH_REDIS_REST_TOKEN;
  else process.env.UPSTASH_REDIS_REST_TOKEN = originalToken;
});

function configureSharedState() {
  process.env.UPSTASH_REDIS_REST_URL = 'https://example.upstash.io';
  process.env.UPSTASH_REDIS_REST_TOKEN = 'server-secret-token';
}

describe('sharedState', () => {
  it('uses an atomic Lua command and never sends the raw client key', async () => {
    configureSharedState();
    const fetchMock = vi.fn().mockResolvedValue(
      new Response(JSON.stringify({ result: [2, 59_000] }), {
        status: 200,
        headers: { 'Content-Type': 'application/json' },
      }),
    );
    vi.stubGlobal('fetch', fetchMock);

    await expect(sharedRateLimit('decode-sig:203.0.113.8', 30, 60_000)).resolves.toEqual({
      count: 2,
      retryAfterSeconds: 0,
    });
    const body = JSON.parse(fetchMock.mock.calls[0][1].body as string) as unknown[];
    expect(body[0]).toBe('EVAL');
    expect(body[3]).not.toContain('203.0.113.8');
  });

  it('round-trips JSON through hashed, expiring shared cache keys', async () => {
    configureSharedState();
    const fetchMock = vi
      .fn()
      .mockResolvedValueOnce(
        new Response(JSON.stringify({ result: 'OK' }), { status: 200 }),
      )
      .mockResolvedValueOnce(
        new Response(
          JSON.stringify({ result: JSON.stringify({ coverage: 'complete' }) }),
          { status: 200 },
        ),
      );
    vi.stubGlobal('fetch', fetchMock);

    await expect(
      setSharedJson('approval-scan', '1:0xabc', { coverage: 'complete' }, 60),
    ).resolves.toBe(true);
    await expect(getSharedJson('approval-scan', '1:0xabc')).resolves.toEqual({
      status: 'hit',
      value: { coverage: 'complete' },
    });

    const setBody = JSON.parse(fetchMock.mock.calls[0][1].body as string) as unknown[];
    expect(setBody).toContain('EX');
    expect(setBody).toContain(60);
    expect(setBody[1]).not.toContain('0xabc');
  });

  it('reserves a cross-instance request slot with a hashed scope', async () => {
    configureSharedState();
    const fetchMock = vi.fn().mockResolvedValue(
      new Response(JSON.stringify({ result: 350 }), { status: 200 }),
    );
    vi.stubGlobal('fetch', fetchMock);

    await expect(reserveSharedRequestSlot('etherscan-v2', 350)).resolves.toBe(350);
    const body = JSON.parse(fetchMock.mock.calls[0][1].body as string) as unknown[];
    expect(body[0]).toBe('EVAL');
    expect(body[3]).not.toContain('etherscan-v2');
  });

  it('stays explicitly unavailable when no shared backend is configured', async () => {
    delete process.env.UPSTASH_REDIS_REST_URL;
    delete process.env.UPSTASH_REDIS_REST_TOKEN;

    await expect(sharedRateLimit('key', 1, 1_000)).resolves.toBeUndefined();
    await expect(getSharedJson('cache', 'key')).resolves.toEqual({
      status: 'unavailable',
    });
  });
});
