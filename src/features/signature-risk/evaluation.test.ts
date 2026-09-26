import { describe, expect, it } from 'vitest';
import { analyzeTypedData, type SignatureRiskKind } from './analyzer';

// Fixed before the classifier/validator changes. These are synthetic,
// standards-shaped inputs, not claims about observed mainnet transactions.
const OWNER = '0xFb3C2B2769A2119f349233A44A640F090C907667';
const SPENDER = '0xE592427A0AEce92De3Edee1F18E0157C05861564';
const TOKEN = '0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48';
const MAX_UINT256 = (2n ** 256n - 1n).toString();
const MAX_UINT160 = (2n ** 160n - 1n).toString();

type Scenario = {
  name: string;
  payload: Record<string, unknown>;
  expectedKind: SignatureRiskKind;
};

const classificationScenarios: Scenario[] = [
  {
    name: 'ERC-20 permit with owner, spender, value and deadline',
    payload: {
      domain: { name: 'USD Coin' }, primaryType: 'Permit',
      message: { owner: OWNER, spender: SPENDER, value: MAX_UINT256, deadline: '4102444800' },
    },
    expectedKind: 'erc20-permit',
  },
  {
    name: 'Permit2 standing allowance with nested details',
    payload: {
      domain: { name: 'Permit2' }, primaryType: 'PermitSingle',
      message: {
        details: { token: TOKEN, amount: MAX_UINT160, expiration: '4102444800', nonce: '1' },
        spender: SPENDER, sigDeadline: '4102444800',
      },
    },
    expectedKind: 'permit2',
  },
  {
    name: 'Permit2 one-time transfer with permitted token',
    payload: {
      domain: { name: 'Permit2' }, primaryType: 'PermitTransferFrom',
      message: { permitted: { token: TOKEN, amount: MAX_UINT256 }, nonce: '1', deadline: '4102444800' },
    },
    expectedKind: 'permit2',
  },
  {
    name: 'order with offer and consideration arrays',
    payload: {
      domain: { name: 'Seaport' }, primaryType: 'OrderComponents',
      message: { offer: [{ token: TOKEN }], consideration: [{ recipient: SPENDER }] },
    },
    expectedKind: 'nft-order',
  },
  {
    name: 'unrelated vote under a Permit2-named domain',
    payload: { domain: { name: 'Permit2 Research' }, primaryType: 'Vote', message: { proposalId: '7' } },
    expectedKind: 'unknown',
  },
  {
    name: 'unrelated typed message named Permit',
    payload: { domain: { name: 'Guestbook' }, primaryType: 'Permit', message: { memo: 'hello' } },
    expectedKind: 'unknown',
  },
  {
    name: 'purchase order name without order assets',
    payload: { domain: { name: 'Shop' }, primaryType: 'PurchaseOrder', message: { memo: 'books' } },
    expectedKind: 'unknown',
  },
  {
    name: 'unrelated vote under a Seaport-named domain',
    payload: { domain: { name: 'Seaport Analytics' }, primaryType: 'Vote', message: { proposalId: '7' } },
    expectedKind: 'unknown',
  },
  {
    name: 'plain-text offer without an order structure',
    payload: { domain: { name: 'Message Board' }, primaryType: 'Note', message: { offer: 'hello' } },
    expectedKind: 'unknown',
  },
  {
    name: 'job operator field without an authorization structure',
    payload: { domain: { name: 'Workboard' }, primaryType: 'Job', message: { operator: SPENDER } },
    expectedKind: 'unknown',
  },
  {
    name: 'Permit name without the required permission fields',
    payload: { domain: { name: 'Token' }, primaryType: 'Permit', message: { owner: OWNER, value: '1' } },
    expectedKind: 'unknown',
  },
  {
    name: 'incomplete Permit2 transfer without nonce or deadline',
    payload: { domain: { name: 'Permit2' }, primaryType: 'PermitTransferFrom', message: { permitted: { token: TOKEN, amount: '1' } } },
    expectedKind: 'unknown',
  },
];

const validSchema = {
  Vote: [
    { name: 'recipient', type: 'address' },
    { name: 'amount', type: 'uint8' },
    { name: 'active', type: 'bool' },
  ],
};

const schemaPayload = (types: Record<string, unknown>, message: Record<string, unknown>) => ({
  domain: { name: 'Example' }, primaryType: 'Vote', types, message,
});

describe('fixed EIP-712 evaluation corpus: classification', () => {
  it.each(classificationScenarios)('$name', ({ payload, expectedKind }) => {
    expect(analyzeTypedData(JSON.stringify(payload)).riskKind).toBe(expectedKind);
  });
});

describe('fixed EIP-712 evaluation corpus: schema integrity', () => {
  it('accepts a structurally valid typed message', () => {
    const result = analyzeTypedData(JSON.stringify(schemaPayload(validSchema, {
      recipient: OWNER, amount: '42', active: true,
    })));
    expect(result.schemaValidated).toBe(true);
  });

  it.each([
    ['missing referenced struct', { Vote: [{ name: 'details', type: 'Details' }] }, { details: { amount: '1' } }],
    ['invalid address', validSchema, { recipient: 'not-an-address', amount: '42', active: true }],
    ['unsigned integer overflow', validSchema, { recipient: OWNER, amount: '256', active: true }],
    ['non-numeric unsigned integer', validSchema, { recipient: OWNER, amount: 'many', active: true }],
    ['non-boolean flag', validSchema, { recipient: OWNER, amount: '42', active: 'yes' }],
    ['unsupported primitive type', { Vote: [{ name: 'when', type: 'date' }] }, { when: 'tomorrow' }],
    ['nonstandard uint alias', { Vote: [{ name: 'amount', type: 'uint' }] }, { amount: '1' }],
  ] as const)('rejects %s', (_name, types, message) => {
    expect(() => analyzeTypedData(JSON.stringify(schemaPayload(types, message)))).toThrow();
  });
});
