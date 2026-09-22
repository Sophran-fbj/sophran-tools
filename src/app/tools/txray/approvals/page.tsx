'use client';

import { Suspense, useMemo, useState } from 'react';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { useAccount, useEnsAddress } from 'wagmi';
import { getAddress, isAddress, type Address } from 'viem';
import { normalize } from 'viem/ens';
import { useApprovals } from '@/features/txray/approvals/useApprovals';
import { useSpenderRisk } from '@/features/txray/approvals/useSpenderRisk';
import {
  DEMO_OWNER,
  demoApprovals,
  demoRiskMap,
} from '@/features/txray/approvals/demoApprovals';
import { WalletButton } from '@/components/WalletButton';
import {
  DEFAULT_TXRAY_CHAIN_ID,
  TXRAY_CHAINS,
  getTxRayChain,
} from '@/features/txray/chains/chains';
import { useTokenPrices } from '@/features/txray/approvals/useTokenPrices';
import { ApprovalRow } from '@/features/txray/approvals/ApprovalRow';
import { LanguageToggle } from '@/components/LanguageToggle';
import { useI18n } from '@/lib/i18n/provider';
import type { ApprovalWarning } from '@/features/txray/approvals/types';

export default function ApprovalsPage() {
  const { t } = useI18n();
  return (
    <Suspense
      fallback={
        <main className="min-h-screen bg-base-100 px-4 py-8 sm:px-6 sm:py-12">
          <div className="mx-auto max-w-4xl">
            <div className="card bg-base-200">
              <div className="card-body items-center gap-3 text-base-content/70">
                <span
                  className="loading loading-spinner loading-md text-primary"
                  aria-hidden="true"
                />
                <span>{t.approvals.loadingPage}</span>
              </div>
            </div>
          </div>
        </main>
      }
    >
      <ApprovalsContent />
    </Suspense>
  );
}

function ApprovalsContent() {
  const { locale, t } = useI18n();
  const searchParams = useSearchParams();
  const demoMode = searchParams.get('demo') === '1';
  const { address: connected, chainId: walletChainId } = useAccount();
  const [input, setInput] = useState('');
  const [selectedChainId, setSelectedChainId] = useState(DEFAULT_TXRAY_CHAIN_ID);
  const effectiveChainId = demoMode ? DEFAULT_TXRAY_CHAIN_ID : selectedChainId;
  const chain = getTxRayChain(effectiveChainId);

  const trimmed = input.trim();
  const looksLikeEns = trimmed.toLowerCase().endsWith('.eth');
  const normalizedEns = looksLikeEns ? safeNormalize(trimmed) : undefined;

  const { data: ensResolved, isLoading: ensLoading } = useEnsAddress({
    name: normalizedEns,
    chainId: 1,
    query: { enabled: !!normalizedEns },
  });

  let target: Address | undefined;
  let inputError: string | undefined;
  if (trimmed) {
    if (isAddress(trimmed)) target = getAddress(trimmed);
    else if (looksLikeEns) target = ensResolved ?? undefined;
    else inputError = t.approvals.invalidAddress;
  } else {
    target = demoMode ? DEMO_OWNER : connected;
  }

  const approvalsQuery = useApprovals(demoMode ? undefined : target, effectiveChainId);
  const scanResult = demoMode
    ? { approvals: demoApprovals, status: 'complete' as const, warnings: [] }
    : approvalsQuery.data;
  const approvals = scanResult?.approvals;
  const isLoading = demoMode ? false : approvalsQuery.isLoading;
  const isError = demoMode ? false : approvalsQuery.isError;

  // 唯一 spender 列表 → 风险画像
  const spenders = useMemo(
    () => (approvals ? Array.from(new Set(approvals.map((a) => a.spender))) : []),
    [approvals],
  );
  const {
    data: liveRiskMap,
    isError: isRiskError,
  } = useSpenderRisk(demoMode ? [] : spenders, effectiveChainId);
  const riskMap = demoMode ? demoRiskMap : liveRiskMap;
  const threatStatus = Object.values(riskMap ?? {})[0]?.threat;
  const threatUnavailable =
    !demoMode &&
    Object.values(riskMap ?? {}).some(
      (risk) => risk.threat.status === 'unavailable',
    );
  const pricedTokens = useMemo(
    () =>
      approvals
        ? approvals
            .filter((a) => a.kind !== 'nft')
            .map((a) => a.token)
        : [],
    [approvals],
  );
  const { data: tokenPrices } = useTokenPrices(effectiveChainId, pricedTokens);

  const canRevoke =
    !demoMode &&
    !!connected &&
    !!target &&
    connected.toLowerCase() === target.toLowerCase();
  const hasPermit2 = approvals?.some((a) => a.kind === 'permit2');

  return (
    <main className="min-h-screen bg-base-100 px-4 py-8 sm:px-6 sm:py-12">
      <div className="mx-auto max-w-4xl">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <Link
              href="/tools/txray"
              className="rounded-sm text-sm text-base-content/70 hover:text-base-content focus-visible:outline focus-visible:outline-2 focus-visible:outline-primary"
            >
              ← TxRay
            </Link>
            <h1 className="mt-2 text-3xl font-bold text-primary">
              {t.approvals.title}
            </h1>
            <p className="mt-1 text-sm text-base-content/70">
              {t.approvals.currentNetwork(chain.name)}
            </p>
          </div>
          <div className="flex items-center gap-2 self-end sm:self-auto">
            <LanguageToggle />
            <WalletButton />
          </div>
        </div>

        {demoMode && (
          <div className="alert alert-info mt-6 text-sm">
            <span>
              {t.approvals.demo}
            </span>
          </div>
        )}

        <div className="form-control mt-8">
          <label className="label" htmlFor="approval-network">
            <span className="label-text">{t.approvals.network}</span>
            <span className="label-text-alt text-base-content/70">
              {t.approvals.supportedNetworks}
            </span>
          </label>
          <select
            id="approval-network"
            className="select select-bordered w-full"
            disabled={demoMode}
            value={effectiveChainId}
            onChange={(e) => setSelectedChainId(Number(e.target.value))}
          >
            {TXRAY_CHAINS.map((item) => (
              <option key={item.id} value={item.id}>
                {item.name}
              </option>
            ))}
          </select>
        </div>

        <div className="form-control mt-4">
          <label className="label" htmlFor="approval-address">
            <span className="label-text">{t.approvals.queryAddress}</span>
            <span className="label-text-alt text-base-content/70">
              {t.approvals.queryAddressHint}
            </span>
          </label>
          <input
            id="approval-address"
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder={t.approvals.addressPlaceholder}
            className="input input-bordered w-full font-mono"
            spellCheck={false}
          />
          {inputError && (
            <span className="mt-1 text-sm text-error" role="alert">{inputError}</span>
          )}
          {looksLikeEns && ensLoading && (
            <span className="mt-1 text-sm text-base-content/70" role="status">
              {t.approvals.resolvingEns}
            </span>
          )}
          {looksLikeEns && !ensLoading && !ensResolved && (
            <span className="mt-1 text-sm text-warning" role="alert">
              {t.approvals.ensFailed}
            </span>
          )}
        </div>

        {target ? (
          <div className="alert mt-6">
            <span className="text-sm">
              {t.approvals.querying}
              <span className="ml-1 break-all font-mono text-primary">{target}</span>
              {!trimmed && connected && (
                <span className="badge badge-sm ml-2">
                  {t.approvals.connectedWallet}
                </span>
              )}
            </span>
          </div>
        ) : (
          <div className="alert alert-info mt-6">
            <span className="text-sm">
              {t.approvals.startHint}
            </span>
          </div>
        )}

        {target && (
          <div className="mt-6">
            {isLoading && (
              <div className="card bg-base-200" role="status">
                <div className="card-body items-center gap-3 text-base-content/70">
                  <span
                    className="loading loading-spinner loading-md text-primary"
                    aria-hidden="true"
                  />
                  <span>{t.approvals.scanning}</span>
                </div>
              </div>
            )}

            {isError && (
              <div className="alert alert-error" role="alert">
                <span className="text-sm">
                  {t.approvals.queryFailed}
                  <br />
                  <span className="text-xs opacity-80">
                    {t.approvals.queryFailedDetail}
                  </span>
                </span>
              </div>
            )}

            {scanResult?.status === 'partial' && (
              <div className="alert alert-warning mb-4" role="alert">
                <div className="text-sm">
                  <div className="font-bold">{t.approvals.partialTitle}</div>
                  <ul className="mt-1 list-disc pl-5">
                    {scanResult.warnings.map((warning) => (
                      <li key={warning.code}>
                        {formatApprovalWarning(warning, t.approvals)}
                      </li>
                    ))}
                  </ul>
                </div>
              </div>
            )}

            {isRiskError && (
              <div className="alert alert-warning mb-4 text-sm" role="alert">
                {t.approvals.riskUnavailable}
              </div>
            )}

            {!isRiskError && threatUnavailable && (
              <div className="alert alert-warning mb-4 text-sm" role="alert">
                {t.approvals.threatUnavailable}
              </div>
            )}

            {!demoMode && !isRiskError && threatStatus?.status === 'available' && (
              <div className="mb-4 text-xs text-base-content/70">
                {t.approvals.threatCoverage}:{' '}
                <a
                  className="link link-hover"
                  href={threatStatus.sourceUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  {threatStatus.sourceName}
                </a>
                {' · '}
                {t.approvals.threatSourceDelay(threatStatus.publicDelayDays)}
                {threatStatus.checkedAt && (
                  <>
                    {' · '}
                    {t.approvals.threatCheckedAt(
                      new Date(threatStatus.checkedAt).toLocaleString(
                        locale === 'zh' ? 'zh-CN' : 'en-US',
                      ),
                    )}
                  </>
                )}
                {threatStatus.stale && ` · ${t.approvals.threatSourceStale}`}
              </div>
            )}

            {scanResult?.status === 'complete' && approvals?.length === 0 && (
              <div className="card bg-base-200">
                <div className="card-body items-center text-center">
                  <p className="text-lg">{t.approvals.cleanTitle}</p>
                  <p className="text-sm text-base-content/70">
                    {t.approvals.cleanDescription}
                  </p>
                </div>
              </div>
            )}

            {approvals && approvals.length > 0 && (
              <>
                <div className="mb-2 flex items-center justify-between">
                  <p className="text-sm text-base-content/70">
                    {t.approvals.approvalCount(approvals.length)}
                  </p>
                  {!canRevoke && (
                    <p className="text-xs text-base-content/70">
                      {t.approvals.readonlyMode}
                    </p>
                  )}
                </div>

                {hasPermit2 && (
                  <details className="collapse-arrow collapse mb-3 bg-base-200 text-sm">
                    <summary className="collapse-title font-medium">
                      {t.approvals.permit2Title}
                    </summary>
                    <div className="collapse-content text-base-content/70">
                      {t.approvals.permit2Description}
                    </div>
                  </details>
                )}

                <div className="rounded-box border border-base-300 md:overflow-x-auto">
                  <table className="table block md:table" aria-label={t.approvals.title}>
                    <thead className="hidden md:table-header-group">
                      <tr>
                        <th>{t.approvals.asset}</th>
                        <th>{t.approvals.spenderRisk}</th>
                        <th className="text-right">{t.approvals.allowance}</th>
                        <th className="text-right">{t.approvals.action}</th>
                      </tr>
                    </thead>
                    <tbody className="block space-y-3 p-3 md:table-row-group md:space-y-0 md:p-0">
                      {approvals.map((a) => (
                        <ApprovalRow
                          key={a.id}
                          approval={a}
                          canRevoke={canRevoke}
                          chainId={effectiveChainId}
                          connected={connected}
                          walletChainId={walletChainId}
                          riskUnavailable={isRiskError}
                          usdPrice={a.kind === 'nft' ? undefined : tokenPrices?.[a.token.toLowerCase()]}
                          risk={riskMap?.[a.spender.toLowerCase()]}
                        />
                      ))}
                    </tbody>
                  </table>
                </div>
              </>
            )}
          </div>
        )}

        <p className="mt-8 text-xs text-base-content/70">
          {t.approvals.readonlyNotice}
        </p>
      </div>
    </main>
  );
}

function formatApprovalWarning(
  warning: ApprovalWarning,
  messages: ReturnType<typeof useI18n>['t']['approvals'],
): string {
  switch (warning.code) {
    case 'index-truncated':
      return messages.warningIndexTruncated(warning.maxRecordsPerSource);
    case 'current-reads-failed':
      return messages.warningCurrentReads(warning.count);
    case 'decimals-failed':
      return messages.warningDecimals(warning.count);
    case 'balances-failed':
      return messages.warningBalances(warning.count);
  }
}

function safeNormalize(name: string): string | undefined {
  try {
    return normalize(name);
  } catch {
    return undefined;
  }
}
