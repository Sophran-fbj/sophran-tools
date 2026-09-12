'use client';

import { useEffect, useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import {
  usePublicClient,
  useSwitchChain,
  useWaitForTransactionReceipt,
  useWriteContract,
} from 'wagmi';
import type { Address } from 'viem';
import type { Approval } from './useApprovals';
import { createRevokeCall } from './revoke';

interface UseRevokeApprovalOptions {
  account?: Address;
  canRevoke: boolean;
  chainId: number;
  walletChainId?: number;
}

export function useRevokeApproval({
  account,
  canRevoke,
  chainId,
  walletChainId,
}: UseRevokeApprovalOptions) {
  const queryClient = useQueryClient();
  const publicClient = usePublicClient({ chainId });
  const { switchChainAsync, isPending: isSwitching } = useSwitchChain();
  const {
    writeContractAsync,
    data: hash,
    isPending: isAwaitingWallet,
    error: writeError,
    reset: resetWrite,
  } = useWriteContract();
  const [prepareError, setPrepareError] = useState<Error>();
  const {
    isLoading: isConfirming,
    isSuccess,
    error: receiptError,
  } = useWaitForTransactionReceipt({ hash, chainId });

  useEffect(() => {
    if (isSuccess) {
      void queryClient.invalidateQueries({ queryKey: ['approvals', chainId] });
    }
  }, [chainId, isSuccess, queryClient]);

  const revoke = async (approval: Approval) => {
    resetWrite();
    setPrepareError(undefined);
    if (!canRevoke || !account || !publicClient) {
      setPrepareError(new Error('钱包或目标链 RPC 不可用'));
      return;
    }

    try {
      if (walletChainId !== chainId) await switchChainAsync({ chainId });
      const call = createRevokeCall(approval);

      if (call.kind === 'erc20') {
        const { request } = await publicClient.simulateContract({
          account,
          address: call.address,
          abi: call.abi,
          functionName: call.functionName,
          args: call.args,
        });
        await writeContractAsync({ ...request, chainId });
      } else if (call.kind === 'nft') {
        const { request } = await publicClient.simulateContract({
          account,
          address: call.address,
          abi: call.abi,
          functionName: call.functionName,
          args: call.args,
        });
        await writeContractAsync({ ...request, chainId });
      } else {
        const { request } = await publicClient.simulateContract({
          account,
          address: call.address,
          abi: call.abi,
          functionName: call.functionName,
          args: call.args,
        });
        await writeContractAsync({ ...request, chainId });
      }
    } catch (error) {
      setPrepareError(
        error instanceof Error ? error : new Error('撤销交易准备失败'),
      );
    }
  };

  return {
    hash,
    isSuccess,
    isSwitching,
    isAwaitingWallet,
    isConfirming,
    busy: isSwitching || isAwaitingWallet || isConfirming,
    error: prepareError ?? writeError ?? receiptError,
    revoke,
  };
}
