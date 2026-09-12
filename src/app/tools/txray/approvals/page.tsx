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

export default function ApprovalsPage() {
  return (
    <Suspense
      fallback={
        <main className="min-h-screen bg-base-100 px-6 py-12">
          <div className="mx-auto max-w-4xl">
            <div className="card bg-base-200">
              <div className="card-body items-center gap-3 text-base-content/60">
                <span className="loading loading-spinner loading-md text-primary" />
                <span>加载授权检查器…</span>
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
    else inputError = '请输入合法地址（0x…）或 ENS 域名（xxx.eth）';
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
  const error = approvalsQuery.error;

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
    <main className="min-h-screen bg-base-100 px-6 py-12">
      <div className="mx-auto max-w-4xl">
        <div className="flex items-start justify-between gap-4">
          <div>
            <Link
              href="/tools/txray"
              className="text-sm text-base-content/60 hover:text-base-content"
            >
              ← TxRay
            </Link>
            <h1 className="mt-2 text-3xl font-bold text-primary">授权检查</h1>
            <p className="mt-1 text-sm text-base-content/60">
              当前网络：{chain.name}
            </p>
          </div>
          <WalletButton />
        </div>

        {demoMode && (
          <div className="alert alert-info mt-6 text-sm">
            <span>
              演示模式：这里展示的是内置样例，不会读取链上数据，也不会发起撤销交易。
              用它可以快速看出 TxRay 如何解释无限授权、Permit2 和 EOA spender 风险。
            </span>
          </div>
        )}

        <div className="form-control mt-8">
          <label className="label">
            <span className="label-text">网络</span>
            <span className="label-text-alt text-base-content/50">
              支持 Ethereum / Base / Arbitrum / Optimism
            </span>
          </label>
          <select
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
          <label className="label">
            <span className="label-text">查询地址</span>
            <span className="label-text-alt text-base-content/50">
              留空则查询已连接的钱包
            </span>
          </label>
          <input
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder="0x… 或 vitalik.eth"
            className="input input-bordered w-full font-mono"
            spellCheck={false}
          />
          {inputError && (
            <span className="mt-1 text-sm text-error">{inputError}</span>
          )}
          {looksLikeEns && ensLoading && (
            <span className="mt-1 text-sm text-base-content/50">解析 ENS 中…</span>
          )}
          {looksLikeEns && !ensLoading && !ensResolved && (
            <span className="mt-1 text-sm text-warning">无法解析该 ENS 域名</span>
          )}
        </div>

        {target ? (
          <div className="alert mt-6">
            <span className="text-sm">
              正在查询：
              <span className="ml-1 break-all font-mono text-primary">{target}</span>
              {!trimmed && connected && (
                <span className="badge badge-sm ml-2">已连接钱包</span>
              )}
            </span>
          </div>
        ) : (
          <div className="alert alert-info mt-6">
            <span className="text-sm">
              连接钱包，或在上方粘贴一个地址 / ENS 开始查询。
            </span>
          </div>
        )}

        {target && (
          <div className="mt-6">
            {isLoading && (
              <div className="card bg-base-200">
                <div className="card-body items-center gap-3 text-base-content/60">
                  <span className="loading loading-spinner loading-md text-primary" />
                  <span>扫描链上授权中…（含 Permit2，全历史事件 + multicall 校验）</span>
                </div>
              </div>
            )}

            {isError && (
              <div className="alert alert-error">
                <span className="text-sm">
                  查询失败：{error?.message ?? '未知错误'}
                  <br />
                  <span className="text-xs opacity-80">
                    “fetch failed” 多为服务端连不上 Etherscan（网络/代理问题）；请看 dev 终端的详细报错。
                  </span>
                </span>
              </div>
            )}

            {scanResult?.status === 'partial' && (
              <div className="alert alert-warning mb-4">
                <div className="text-sm">
                  <div className="font-bold">扫描结果不完整，不能据此判断该地址安全</div>
                  <ul className="mt-1 list-disc pl-5">
                    {scanResult.warnings.map((warning) => (
                      <li key={warning}>{warning}</li>
                    ))}
                  </ul>
                </div>
              </div>
            )}

            {isRiskError && (
              <div className="alert alert-warning mb-4 text-sm">
                spender 风险画像暂时不可用；授权额度仍来自链上实时读取。
              </div>
            )}

            {scanResult?.status === 'complete' && approvals?.length === 0 && (
              <div className="card bg-base-200">
                <div className="card-body items-center text-center">
                  <p className="text-lg">✅ 很干净</p>
                  <p className="text-sm text-base-content/60">
                    该地址当前没有有效的代币授权。
                  </p>
                </div>
              </div>
            )}

            {approvals && approvals.length > 0 && (
              <>
                <div className="mb-2 flex items-center justify-between">
                  <p className="text-sm text-base-content/60">
                    共 {approvals.length} 条有效授权
                  </p>
                  {!canRevoke && (
                    <p className="text-xs text-base-content/50">
                      只读模式：连接该地址的钱包后才能撤销
                    </p>
                  )}
                </div>

                {hasPermit2 && (
                  <details className="collapse-arrow collapse mb-3 bg-base-200 text-sm">
                    <summary className="collapse-title font-medium">
                      ℹ️ 什么是 Permit2 授权？为什么也要管
                    </summary>
                    <div className="collapse-content text-base-content/70">
                      你在 Uniswap 等应用点的 approve，很多时候是授权给{' '}
                      <span className="font-mono">Permit2</span>{' '}
                      合约，由它再把额度分发给具体的 spender（如 Universal
                      Router），带额度和到期时间。所以「授权给 Permit2」只是表层——
                      这里列出的{' '}
                      <span className="badge badge-info badge-sm">Permit2</span>{' '}
                      条目，才是 Permit2 内部替你授权的真实对象，它们才是真正能动你币的权限。
                    </div>
                  </details>
                )}

                <div className="overflow-x-auto rounded-box border border-base-300">
                  <table className="table">
                    <thead>
                      <tr>
                        <th>资产</th>
                        <th>被授权方 / 风险</th>
                        <th className="text-right">当前额度</th>
                        <th className="text-right">操作</th>
                      </tr>
                    </thead>
                    <tbody>
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

        <p className="mt-8 text-xs text-base-content/50">
          🔒 只读查询不发起任何交易；撤销由你的钱包签名，本站绝不接触私钥。
        </p>
      </div>
    </main>
  );
}

function safeNormalize(name: string): string | undefined {
  try {
    return normalize(name);
  } catch {
    return undefined;
  }
}
