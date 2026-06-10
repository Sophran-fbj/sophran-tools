import { describe, expect, it } from 'vitest';
import { analyzeTypedData } from './analyzer';

const MAX_UINT256 =
  '115792089237316195423570985008687907853269984665640564039457584007913129639935';

describe('analyzeTypedData', () => {
  it('flags unlimited ERC-20 permit signatures as high risk', () => {
    const result = analyzeTypedData(
      JSON.stringify({
        domain: {
          name: 'USD Coin',
          verifyingContract: '0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48',
        },
        primaryType: 'Permit',
        message: {
          owner: '0xFb3C2B2769A2119f349233A44A640F090C907667',
          spender: '0xE592427A0AEce92De3Edee1F18E0157C05861564',
          value: MAX_UINT256,
          nonce: '8',
          deadline: '4102444800',
        },
      }),
    );

    expect(result.danger).toBe('high');
    expect(result.title).toBe('ERC-20 permit approval');
    expect(result.findings).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          label: 'Spender',
          value: '0xE592427A0AEce92De3Edee1F18E0157C05861564',
        }),
        expect.objectContaining({
          label: 'Amount',
          value: 'Unlimited (max uint256)',
          severity: 'high',
        }),
      ]),
    );
  });

  it('recognizes nested Permit2 payloads', () => {
    const result = analyzeTypedData(
      JSON.stringify({
        domain: {
          name: 'Permit2',
          verifyingContract: '0x000000000022D473030F116dDEE9F6B43aC78BA3',
        },
        primaryType: 'PermitSingle',
        message: {
          details: {
            token: '0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48',
            amount: '1461501637330902918203684832716283019655932542975',
            expiration: '4102444800',
            nonce: '12',
          },
          spender: '0xEf1c6E67703c7BD7107eed8303Fbe6EC2554BF6B',
          sigDeadline: '4102444800',
        },
      }),
    );

    expect(result.danger).toBe('high');
    expect(result.title).toBe('Permit2 token spending approval');
    expect(result.findings.some((f) => f.label === 'Token')).toBe(true);
    expect(result.findings.some((f) => f.label === 'Spender')).toBe(true);
  });

  it('does not pretend unknown typed data is classified', () => {
    const result = analyzeTypedData(
      JSON.stringify({
        domain: { name: 'Example App' },
        primaryType: 'Vote',
        message: { proposalId: '7', support: true },
      }),
    );

    expect(result.danger).toBe('unknown');
    expect(result.title).toBe('Unknown typed-data signature');
    expect(result.findings).toHaveLength(0);
  });
});
