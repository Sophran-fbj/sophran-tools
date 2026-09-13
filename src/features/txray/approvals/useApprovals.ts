'use client';

import { useQuery } from '@tanstack/react-query';
import { usePublicClient } from 'wagmi';
import type { Address } from 'viem';
import { readApprovals } from './readApprovals';
import type { ApprovalScanResult } from './types';

export type {
  Approval,
  ApprovalScanResult,
  ApprovalWarning,
  Erc20Approval,
  NftApproval,
  Permit2Approval,
} from './types';
export { parseApprovalIndexPayload } from './approvalIndex';

export function useApprovals(owner: Address | undefined, chainId = 1) {
  const client = usePublicClient({ chainId });

  return useQuery<ApprovalScanResult>({
    queryKey: ['approvals', chainId, owner?.toLowerCase()],
    enabled: Boolean(owner && client),
    staleTime: 60_000,
    queryFn: async () => {
      if (!client || !owner) throw new Error('RPC 或查询地址不可用');
      return readApprovals(client, owner, chainId);
    },
  });
}
