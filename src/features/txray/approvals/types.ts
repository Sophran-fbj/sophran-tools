import type { Address } from 'viem';

export interface FungibleApprovalDisplay {
  symbol: string;
  decimals: number | null;
  amountText: string;
  atRiskAmountRaw?: bigint;
  atRiskAmountText?: string;
}

export interface Erc20Approval extends FungibleApprovalDisplay {
  kind: 'erc20';
  id: string;
  token: Address;
  spender: Address;
  allowance: bigint;
  unlimited: boolean;
}

export interface NftApproval {
  kind: 'nft';
  id: string;
  token: Address;
  spender: Address;
  symbol: string;
}

export interface Permit2Approval extends FungibleApprovalDisplay {
  kind: 'permit2';
  id: string;
  token: Address;
  spender: Address;
  amount: bigint;
  expiration: number;
  unlimited: boolean;
}

export type Approval = Erc20Approval | NftApproval | Permit2Approval;

export type ApprovalWarning =
  | { code: 'index-truncated'; maxRecordsPerSource: number }
  | { code: 'current-reads-failed'; count: number }
  | { code: 'decimals-failed'; count: number }
  | { code: 'balances-failed'; count: number };

export interface ApprovalScanResult {
  approvals: Approval[];
  status: 'complete' | 'partial';
  warnings: ApprovalWarning[];
}
