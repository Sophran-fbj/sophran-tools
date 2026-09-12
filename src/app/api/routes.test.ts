import { afterEach, describe, expect, it } from 'vitest';
import { NextRequest } from 'next/server';
import { GET as getApprovals } from './approvals/route';
import { GET as decodeSignature } from './decode-sig/route';
import { GET as getSpenderInfo } from './spender-info/route';

const originalEtherscanKey = process.env.ETHERSCAN_API_KEY;

afterEach(() => {
  if (originalEtherscanKey === undefined) {
    delete process.env.ETHERSCAN_API_KEY;
  } else {
    process.env.ETHERSCAN_API_KEY = originalEtherscanKey;
  }
});

function request(path: string, ip: string): NextRequest {
  return new NextRequest(`http://localhost${path}`, {
    headers: { 'x-forwarded-for': ip },
  });
}

describe('API input boundaries', () => {
  it('rejects malformed selectors before calling OpenChain', async () => {
    const response = await decodeSignature(
      request('/api/decode-sig?selector=0x1234', 'test-decode'),
    );
    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toMatchObject({ signature: null });
  });

  it('rejects unsupported spender-info chains', async () => {
    const response = await getSpenderInfo(
      request('/api/spender-info?chainId=999&addresses=', 'test-spender'),
    );
    expect(response.status).toBe(400);
    await expect(response.json()).resolves.toMatchObject({
      error: { code: 'UNSUPPORTED_CHAIN' },
    });
  });

  it('validates approval input before checking server configuration', async () => {
    delete process.env.ETHERSCAN_API_KEY;
    const invalid = await getApprovals(
      request('/api/approvals?owner=invalid&chainId=1', 'test-approval-invalid'),
    );
    expect(invalid.status).toBe(400);

    const valid = await getApprovals(
      request(
        '/api/approvals?owner=0x0000000000000000000000000000000000000001&chainId=1',
        'test-approval-config',
      ),
    );
    expect(valid.status).toBe(503);
    await expect(valid.json()).resolves.toMatchObject({
      error: { code: 'CONFIG_MISSING' },
    });
  });
});
