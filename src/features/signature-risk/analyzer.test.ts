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
          value: 'Unlimited (uint256 max)',
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
    expect(result.findings).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          kind: 'amount',
          value: 'Unlimited (uint160 max)',
          severity: 'high',
        }),
      ]),
    );
    expect(result.schemaValidated).toBe(false);
  });

  it('walks every item in a Permit2 batch using the declared schema', () => {
    const result = analyzeTypedData(
      JSON.stringify({
        domain: { name: 'Permit2', chainId: 1 },
        primaryType: 'PermitBatch',
        types: {
          PermitDetails: [
            { name: 'token', type: 'address' },
            { name: 'amount', type: 'uint160' },
            { name: 'expiration', type: 'uint48' },
            { name: 'nonce', type: 'uint48' },
          ],
          PermitBatch: [
            { name: 'details', type: 'PermitDetails[]' },
            { name: 'spender', type: 'address' },
            { name: 'sigDeadline', type: 'uint256' },
          ],
        },
        message: {
          details: [
            {
              token: '0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48',
              amount: '1',
              expiration: '4102444800',
              nonce: '1',
            },
            {
              token: '0xC02aaA39b223FE8D0A0e5C4F27eAD9083C756Cc2',
              amount: '2',
              expiration: '4102444800',
              nonce: '2',
            },
          ],
          spender: '0xEf1c6E67703c7BD7107eed8303Fbe6EC2554BF6B',
          sigDeadline: '4102444800',
        },
      }),
    );

    expect(result.findings.filter((finding) => finding.kind === 'token')).toHaveLength(2);
    expect(result.findings.filter((finding) => finding.kind === 'amount')).toHaveLength(2);
    expect(result.findings.some((finding) => finding.path === 'message.details[1].amount')).toBe(true);
    expect(result.schemaValidated).toBe(true);
  });

  it('parses JSON-RPC params when typed data is encoded as a JSON string', () => {
    const typedData = {
      domain: { name: 'USD Coin' },
      primaryType: 'Permit',
      message: {
        owner: '0xFb3C2B2769A2119f349233A44A640F090C907667',
        spender: '0xE592427A0AEce92De3Edee1F18E0157C05861564',
        value: '10',
        deadline: '4102444800',
      },
    };
    const result = analyzeTypedData(
      JSON.stringify({ jsonrpc: '2.0', method: 'eth_signTypedData_v4', params: ['0x0', JSON.stringify(typedData)] }),
    );

    expect(result.riskKind).toBe('erc20-permit');
    expect(result.findings).toEqual(
      expect.arrayContaining([expect.objectContaining({ kind: 'spender' })]),
    );
  });

  it('marks an expired permit as low risk instead of long-lived', () => {
    const result = analyzeTypedData(
      JSON.stringify({
        domain: { name: 'USD Coin' },
        primaryType: 'Permit',
        message: {
          owner: '0xFb3C2B2769A2119f349233A44A640F090C907667',
          spender: '0xE592427A0AEce92De3Edee1F18E0157C05861564',
          value: '10',
          deadline: '1',
        },
      }),
    );

    expect(result.signatureExpired).toBe(true);
    expect(result.danger).toBe('low');
    expect(result.findings).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ kind: 'deadline', expired: true, severity: 'low' }),
      ]),
    );
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
