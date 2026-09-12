import { describe, expect, it } from 'vitest';
import { getAddress } from 'viem';
import { PERMIT2_ADDRESS } from './permit2';
import { createRevokeCall } from './revoke';
import type { Approval } from './useApprovals';

const token = getAddress('0x0000000000000000000000000000000000000001');
const spender = getAddress('0x0000000000000000000000000000000000000002');

describe('createRevokeCall', () => {
  it('builds an ERC-20 zero approval', () => {
    const approval: Approval = {
      kind: 'erc20', id: 'erc20', token, spender, allowance: 1n,
      unlimited: false, symbol: 'TKN', decimals: 18, amountText: '1',
    };
    const call = createRevokeCall(approval);
    expect(call).toMatchObject({
      kind: 'erc20', address: token, functionName: 'approve', args: [spender, 0n],
    });
  });

  it('builds an NFT operator revoke', () => {
    const approval: Approval = {
      kind: 'nft', id: 'nft', token, spender, symbol: 'NFT',
    };
    const call = createRevokeCall(approval);
    expect(call).toMatchObject({
      kind: 'nft', address: token, functionName: 'setApprovalForAll',
      args: [spender, false],
    });
  });

  it('builds a Permit2 zero allowance with zero expiration', () => {
    const approval: Approval = {
      kind: 'permit2', id: 'permit2', token, spender, amount: 1n,
      expiration: 1, unlimited: false, symbol: 'TKN', decimals: 18,
      amountText: '1',
    };
    const call = createRevokeCall(approval);
    expect(call).toMatchObject({
      kind: 'permit2', address: PERMIT2_ADDRESS, functionName: 'approve',
      args: [token, spender, 0n, 0],
    });
  });
});
