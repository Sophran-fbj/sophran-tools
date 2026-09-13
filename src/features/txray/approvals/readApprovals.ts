import type { Address, PublicClient } from 'viem';
import { isRecord } from '@/lib/validation';
import { parseApprovalIndexPayload } from './approvalIndex';
import { readCurrentApprovalState } from './readCurrentApprovalState';
import { enrichApprovals } from './enrichApprovals';
import type { ApprovalScanResult, ApprovalWarning } from './types';

export async function readApprovals(
  client: PublicClient,
  owner: Address,
  chainId: number,
): Promise<ApprovalScanResult> {
  const response = await fetch(`/api/approvals?owner=${owner}&chainId=${chainId}`);
  const json: unknown = await response.json();
  if (!response.ok) {
    if (
      isRecord(json) &&
      isRecord(json.error) &&
      typeof json.error.message === 'string'
    ) {
      throw new Error(json.error.message);
    }
    throw new Error('获取授权记录失败');
  }

  const index = parseApprovalIndexPayload(json);
  const warnings: ApprovalWarning[] = [];
  if (index.coverage.status === 'partial') {
    warnings.push({
      code: 'index-truncated',
      maxRecordsPerSource: index.coverage.maxRecordsPerSource,
    });
  }

  const current = await readCurrentApprovalState(client, owner, index);
  if (current.failedReads > 0) {
    warnings.push({ code: 'current-reads-failed', count: current.failedReads });
  }

  const enriched = await enrichApprovals(client, owner, current);
  if (enriched.failedDecimals > 0) {
    warnings.push({ code: 'decimals-failed', count: enriched.failedDecimals });
  }
  if (enriched.failedBalances > 0) {
    warnings.push({ code: 'balances-failed', count: enriched.failedBalances });
  }

  return {
    approvals: enriched.approvals,
    status: warnings.length ? 'partial' : 'complete',
    warnings,
  };
}
