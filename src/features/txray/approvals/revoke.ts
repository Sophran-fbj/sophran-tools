import { erc20Abi, erc721Abi, type Address } from 'viem';
import type { Approval } from './useApprovals';
import { PERMIT2_ADDRESS, permit2Abi } from './permit2';

export type RevokeCall =
  | {
      kind: 'erc20';
      address: Address;
      abi: typeof erc20Abi;
      functionName: 'approve';
      args: readonly [Address, 0n];
    }
  | {
      kind: 'nft';
      address: Address;
      abi: typeof erc721Abi;
      functionName: 'setApprovalForAll';
      args: readonly [Address, false];
    }
  | {
      kind: 'permit2';
      address: Address;
      abi: typeof permit2Abi;
      functionName: 'approve';
      args: readonly [Address, Address, 0n, 0];
    };

/** Builds the exact contract call that will be simulated and sent to the wallet. */
export function createRevokeCall(approval: Approval): RevokeCall {
  if (approval.kind === 'erc20') {
    return {
      kind: approval.kind,
      address: approval.token,
      abi: erc20Abi,
      functionName: 'approve',
      args: [approval.spender, 0n],
    };
  }

  if (approval.kind === 'nft') {
    return {
      kind: approval.kind,
      address: approval.token,
      abi: erc721Abi,
      functionName: 'setApprovalForAll',
      args: [approval.spender, false],
    };
  }

  return {
    kind: approval.kind,
    address: PERMIT2_ADDRESS,
    abi: permit2Abi,
    functionName: 'approve',
    args: [approval.token, approval.spender, 0n, 0],
  };
}
