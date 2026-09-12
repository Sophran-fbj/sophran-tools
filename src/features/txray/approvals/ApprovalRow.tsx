'use client';

import type { Address } from 'viem';
import type { Approval } from './useApprovals';
import type { SpenderRisk } from './useSpenderRisk';
import { useRevokeApproval } from './useRevokeApproval';
import {
  explorerAddressUrl,
  explorerTxUrl,
  getTxRayChain,
} from '../chains/chains';

interface ApprovalRowProps {
  approval: Approval;
  canRevoke: boolean;
  chainId: number;
  connected?: Address;
  walletChainId?: number;
  usdPrice?: number;
  risk?: SpenderRisk;
  riskUnavailable?: boolean;
}

export function ApprovalRow({
  approval,
  canRevoke,
  chainId,
  connected,
  walletChainId,
  usdPrice,
  risk,
  riskUnavailable = false,
}: ApprovalRowProps) {
  const transaction = useRevokeApproval({
    account: connected,
    canRevoke,
    chainId,
    walletChainId,
  });

  return (
    <tr>
      <td>
        <div className="flex items-center gap-2">
          <span className="font-semibold">{approval.symbol}</span>
          {approval.kind === 'nft' && (
            <span className="badge badge-ghost badge-sm">NFT 集合</span>
          )}
          {approval.kind === 'permit2' && (
            <span className="badge badge-info badge-sm">Permit2</span>
          )}
        </div>
        <AddressLink address={approval.token} chainId={chainId} />
      </td>
      <td>
        <RiskBadge risk={risk} unavailable={riskUnavailable} />
        <AddressLink address={approval.spender} chainId={chainId} />
        {risk && risk.level !== 'known' && (
          <div className="mt-0.5 text-xs text-base-content/50">{risk.reason}</div>
        )}
      </td>
      <td className="text-right">
        {approval.kind === 'nft' ? (
          <span className="badge badge-error badge-sm">全部 NFT</span>
        ) : approval.unlimited ? (
          <span className="badge badge-error badge-sm">无限</span>
        ) : (
          <span className="font-mono text-sm">{approval.amountText}</span>
        )}
        {approval.kind === 'permit2' && (
          <div className="text-xs text-base-content/50">
            {formatExpiry(approval.expiration)}
          </div>
        )}
        {approval.kind !== 'nft' && (
          <AtRisk approval={approval} usdPrice={usdPrice} />
        )}
      </td>
      <td className="text-right">
        {transaction.isSuccess ? (
          <span className="text-sm text-success">已撤销</span>
        ) : (
          <button
            className="btn btn-error btn-xs"
            disabled={!canRevoke || transaction.busy}
            onClick={() => void transaction.revoke(approval)}
            title={canRevoke ? '撤销此授权' : '连接该地址的钱包才能撤销'}
          >
            {transaction.isSwitching
              ? '切换网络…'
              : transaction.isAwaitingWallet
                ? '确认中…'
                : transaction.isConfirming
                  ? '链上确认中…'
                  : walletChainId !== chainId && canRevoke
                    ? `切换到 ${getTxRayChain(chainId).name} 并撤销`
                    : '撤销'}
          </button>
        )}
        {transaction.hash && (
          <div className="mt-1">
            <a
              className="link link-primary text-xs"
              href={explorerTxUrl(chainId, transaction.hash)}
              rel="noopener noreferrer"
              target="_blank"
            >
              查看交易
            </a>
          </div>
        )}
        {transaction.error && (
          <div className="mt-1 text-xs text-error">
            {shortError(transaction.error)}
          </div>
        )}
      </td>
    </tr>
  );
}

function RiskBadge({
  risk,
  unavailable,
}: {
  risk?: SpenderRisk;
  unavailable: boolean;
}) {
  if (unavailable) {
    return <span className="badge badge-warning badge-sm">无法验证</span>;
  }
  if (!risk) return <span className="badge badge-ghost badge-sm">分析中…</span>;

  switch (risk.level) {
    case 'malicious':
      return <span className="badge badge-error badge-sm">⚠ 已知恶意</span>;
    case 'eoa':
      return <span className="badge badge-error badge-sm">⚠ 非合约 (EOA)</span>;
    case 'new':
      return <span className="badge badge-warning badge-sm">新合约</span>;
    case 'known':
      return <span className="badge badge-success badge-sm">{risk.labelName}</span>;
    default:
      return <span className="badge badge-warning badge-sm">未知合约</span>;
  }
}

function AtRisk({
  approval,
  usdPrice,
}: {
  approval: Extract<Approval, { kind: 'erc20' | 'permit2' }>;
  usdPrice?: number;
}) {
  const usdValue =
    typeof usdPrice === 'number' && approval.atRiskAmountText
      ? Number(approval.atRiskAmountText) * usdPrice
      : undefined;

  return (
    <div className="mt-1 text-xs text-base-content/50">
      暴露：{approval.atRiskAmountText ?? '未知'}{' '}
      {approval.atRiskAmountText ? approval.symbol : ''}
      {typeof usdValue === 'number' && Number.isFinite(usdValue) && (
        <span className="ml-1 text-warning">≈ ${formatUsd(usdValue)} at risk</span>
      )}
    </div>
  );
}

function AddressLink({ address, chainId }: { address: string; chainId: number }) {
  return (
    <a
      href={explorerAddressUrl(chainId, address)}
      target="_blank"
      rel="noopener noreferrer"
      className="link link-hover font-mono text-xs text-base-content/60"
    >
      {address.slice(0, 8)}…{address.slice(-6)}
    </a>
  );
}

function formatUsd(value: number): string {
  if (value >= 1000) {
    return value.toLocaleString('en-US', { maximumFractionDigits: 0 });
  }
  if (value >= 1) {
    return value.toLocaleString('en-US', { maximumFractionDigits: 2 });
  }
  return value.toLocaleString('en-US', { maximumSignificantDigits: 2 });
}

function formatExpiry(expiration: number): string {
  const farFuture = 32_503_680_000;
  if (expiration > farFuture) return '永久';
  return `到期 ${new Date(expiration * 1000).toLocaleDateString('zh-CN')}`;
}

function shortError(error: Error): string {
  if (/rejected|denied/i.test(error.message)) return '已取消';
  return error.message.split('\n')[0].slice(0, 60);
}
