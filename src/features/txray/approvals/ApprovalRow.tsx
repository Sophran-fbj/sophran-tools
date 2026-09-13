'use client';

import type { Address } from 'viem';
import type { Approval } from './types';
import type { SpenderRisk } from './useSpenderRisk';
import { useRevokeApproval } from './useRevokeApproval';
import {
  explorerAddressUrl,
  explorerTxUrl,
  getTxRayChain,
} from '../chains/chains';
import { useI18n } from '@/lib/i18n/provider';

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
  const { locale, t } = useI18n();
  const transaction = useRevokeApproval({
    account: connected,
    canRevoke,
    chainId,
    walletChainId,
  });
  const cellClass = 'block px-0 py-2 md:table-cell md:px-4 md:py-3';

  return (
    <tr className="block rounded-box border border-base-300 p-4 md:table-row md:border-0 md:p-0">
      <td className={cellClass}>
        <MobileLabel>{t.approvals.asset}</MobileLabel>
        <div className="flex items-center gap-2">
          <span className="font-semibold">{approval.symbol}</span>
          {approval.kind === 'nft' && (
            <span className="badge badge-ghost badge-sm">
              {t.approvals.nftCollection}
            </span>
          )}
          {approval.kind === 'permit2' && (
            <span className="badge badge-info badge-sm">Permit2</span>
          )}
        </div>
        <AddressLink address={approval.token} chainId={chainId} />
      </td>
      <td className={cellClass}>
        <MobileLabel>{t.approvals.spenderRisk}</MobileLabel>
        <RiskBadge risk={risk} unavailable={riskUnavailable} />
        <AddressLink address={approval.spender} chainId={chainId} />
        {risk && risk.level !== 'known' && (
          <div className="mt-0.5 text-xs text-base-content/70">
            {formatRiskReason(risk, t.approvals)}
          </div>
        )}
      </td>
      <td className={`${cellClass} md:text-right`}>
        <MobileLabel>{t.approvals.allowance}</MobileLabel>
        {approval.kind === 'nft' ? (
          <span className="badge badge-error badge-sm">{t.approvals.allNfts}</span>
        ) : approval.unlimited ? (
          <span className="badge badge-error badge-sm">{t.approvals.unlimited}</span>
        ) : (
          <span className="font-mono text-sm">{approval.amountText}</span>
        )}
        {approval.kind === 'permit2' && (
          <div className="text-xs text-base-content/70">
            {formatExpiry(approval.expiration, locale, t.approvals)}
          </div>
        )}
        {approval.kind !== 'nft' && (
          <AtRisk approval={approval} usdPrice={usdPrice} />
        )}
      </td>
      <td className={`${cellClass} md:text-right`} aria-live="polite">
        <MobileLabel>{t.approvals.action}</MobileLabel>
        {transaction.isSuccess ? (
          <span className="text-sm text-success">{t.approvals.revoked}</span>
        ) : (
          <button
            type="button"
            className="btn btn-error btn-sm md:btn-xs"
            disabled={!canRevoke || transaction.busy}
            aria-busy={transaction.busy}
            onClick={() => void transaction.revoke(approval)}
            title={
              canRevoke
                ? t.approvals.revokeTitle
                : t.approvals.revokeDisabledTitle
            }
          >
            {transaction.isSwitching
              ? t.approvals.switching
              : transaction.isAwaitingWallet
                ? t.approvals.walletConfirming
                : transaction.isConfirming
                  ? t.approvals.chainConfirming
                  : walletChainId !== chainId && canRevoke
                    ? t.approvals.switchAndRevoke(getTxRayChain(chainId).name)
                    : t.approvals.revoke}
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
              {t.approvals.viewTransaction}
            </a>
          </div>
        )}
        {transaction.error && (
          <div className="mt-1 text-xs text-error" role="alert">
            {shortError(transaction.error, t.approvals)}
          </div>
        )}
      </td>
    </tr>
  );
}

function MobileLabel({ children }: { children: string }) {
  return (
    <div className="mb-1 text-xs font-semibold uppercase text-base-content/70 md:hidden">
      {children}
    </div>
  );
}

function RiskBadge({
  risk,
  unavailable,
}: {
  risk?: SpenderRisk;
  unavailable: boolean;
}) {
  const { t } = useI18n();
  if (unavailable) {
    return (
      <span className="badge badge-warning badge-sm">
        {t.approvals.riskUnavailableBadge}
      </span>
    );
  }
  if (!risk) {
    return (
      <span className="badge badge-ghost badge-sm">
        {t.approvals.riskAnalyzing}
      </span>
    );
  }

  switch (risk.level) {
    case 'malicious':
      return <span className="badge badge-error badge-sm">{t.approvals.riskMalicious}</span>;
    case 'eoa':
      return <span className="badge badge-error badge-sm">{t.approvals.riskEoa}</span>;
    case 'new':
      return <span className="badge badge-warning badge-sm">{t.approvals.riskNew}</span>;
    case 'known':
      return <span className="badge badge-success badge-sm">{risk.labelName}</span>;
    default:
      return <span className="badge badge-warning badge-sm">{t.approvals.riskUnknown}</span>;
  }
}

function AtRisk({
  approval,
  usdPrice,
}: {
  approval: Extract<Approval, { kind: 'erc20' | 'permit2' }>;
  usdPrice?: number;
}) {
  const { t } = useI18n();
  const usdValue =
    typeof usdPrice === 'number' && approval.atRiskAmountText
      ? Number(approval.atRiskAmountText) * usdPrice
      : undefined;

  return (
    <div className="mt-1 text-xs text-base-content/70">
      {t.approvals.exposure}: {approval.atRiskAmountText ?? t.approvals.unknown}{' '}
      {approval.atRiskAmountText ? approval.symbol : ''}
      {typeof usdValue === 'number' && Number.isFinite(usdValue) && (
        <span className="ml-1 text-warning">≈ ${formatUsd(usdValue)}</span>
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
      aria-label={address}
      className="link link-hover rounded-sm break-all font-mono text-xs text-base-content/70 focus-visible:outline focus-visible:outline-2 focus-visible:outline-primary"
    >
      {address.slice(0, 8)}…{address.slice(-6)}
    </a>
  );
}

function formatRiskReason(
  risk: SpenderRisk,
  messages: ReturnType<typeof useI18n>['t']['approvals'],
): string {
  switch (risk.level) {
    case 'malicious':
      return messages.reasonMalicious;
    case 'eoa':
      return messages.reasonEoa;
    case 'new': {
      const now = Math.floor(Date.now() / 1000);
      const days = risk.createdAt
        ? Math.max(0, Math.floor((now - risk.createdAt) / 86_400))
        : 0;
      return messages.reasonNew(days);
    }
    case 'unknown':
      return risk.codeVerified
        ? messages.reasonUnknown
        : messages.reasonRpcUnavailable;
    case 'known':
      return risk.labelName ?? messages.reasonUnknown;
  }
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

function formatExpiry(
  expiration: number,
  locale: 'zh' | 'en',
  messages: ReturnType<typeof useI18n>['t']['approvals'],
): string {
  const farFuture = 32_503_680_000;
  if (expiration > farFuture) return messages.permanent;
  const date = new Date(expiration * 1000).toLocaleDateString(
    locale === 'zh' ? 'zh-CN' : 'en-US',
  );
  return messages.expires(date);
}

function shortError(
  error: Error,
  messages: ReturnType<typeof useI18n>['t']['approvals'],
): string {
  if (/rejected|denied/i.test(error.message)) return messages.cancelled;
  if (error.message === '钱包或目标链 RPC 不可用') {
    return messages.walletUnavailable;
  }
  if (error.message === '撤销交易准备失败') return messages.revokeFailed;
  return error.message.split('\n')[0].slice(0, 60);
}
