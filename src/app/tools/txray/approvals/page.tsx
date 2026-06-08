'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useAccount, useEnsAddress } from 'wagmi';
import { ConnectButton } from '@rainbow-me/rainbowkit';
import { isAddress, type Address } from 'viem';
import { normalize } from 'viem/ens';
import { useApprovals, type Approval } from '@/features/txray/approvals/useApprovals';

export default function ApprovalsPage() {
  const { address: connected } = useAccount();
  const [input, setInput] = useState('');

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
    if (isAddress(trimmed)) target = trimmed as Address;
    else if (looksLikeEns) target = ensResolved ?? undefined;
    else inputError = '请输入合法地址（0x…）或 ENS 域名（xxx.eth）';
  } else {
    target = connected;
  }

  const { data: approvals, isLoading, isError, error } = useApprovals(target, 1);

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
            <p className="mt-1 text-sm text-base-content/60">仅查询以太坊主网</p>
          </div>
          <ConnectButton />
        </div>

        <div className="form-control mt-8">
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

        {/* 结果区 */}
        {target && (
          <div className="mt-6">
            {isLoading && (
              <div className="card bg-base-200">
                <div className="card-body items-center gap-3 text-base-content/60">
                  <span className="loading loading-spinner loading-md text-primary" />
                  <span>扫描链上授权中…（全历史事件 + multicall 校验）</span>
                </div>
              </div>
            )}

            {isError && (
              <div className="alert alert-error">
                <span className="text-sm">
                  查询失败：{(error as Error)?.message ?? '未知错误'}
                  <br />
                  <span className="text-xs opacity-80">
                    “fetch failed” 多为服务端连不上 Etherscan（网络/代理问题）；请看 dev 终端的详细报错。
                  </span>
                </span>
              </div>
            )}

            {approvals && approvals.length === 0 && (
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
                <p className="mb-2 text-sm text-base-content/60">
                  共 {approvals.length} 条有效授权
                </p>
                <div className="overflow-x-auto rounded-box border border-base-300">
                  <table className="table">
                    <thead>
                      <tr>
                        <th>资产</th>
                        <th>被授权方</th>
                        <th className="text-right">当前额度</th>
                      </tr>
                    </thead>
                    <tbody>
                      {approvals.map((a) => (
                        <ApprovalRow key={a.id} a={a} />
                      ))}
                    </tbody>
                  </table>
                </div>
              </>
            )}
          </div>
        )}

        <p className="mt-8 text-xs text-base-content/50">
          🔒 只读查询，不会发起任何交易；撤销功能将通过你的钱包签名，本站绝不接触私钥。
        </p>
      </div>
    </main>
  );
}

function ApprovalRow({ a }: { a: Approval }) {
  return (
    <tr>
      <td>
        <div className="flex items-center gap-2">
          <span className="font-semibold">{a.symbol}</span>
          {a.kind === 'nft' && (
            <span className="badge badge-ghost badge-sm">NFT 集合</span>
          )}
        </div>
        <AddrLink addr={a.token} />
      </td>
      <td>
        <AddrLink addr={a.spender} />
      </td>
      <td className="text-right">
        {a.kind === 'nft' ? (
          <span className="badge badge-error badge-sm">全部 NFT</span>
        ) : a.unlimited ? (
          <span className="badge badge-error badge-sm">无限</span>
        ) : (
          <span className="font-mono text-sm">{a.amountText}</span>
        )}
      </td>
    </tr>
  );
}

function AddrLink({ addr }: { addr: string }) {
  return (
    <a
      href={`https://etherscan.io/address/${addr}`}
      target="_blank"
      rel="noopener noreferrer"
      className="link link-hover font-mono text-xs text-base-content/60"
    >
      {addr.slice(0, 8)}…{addr.slice(-6)}
    </a>
  );
}

function safeNormalize(name: string): string | undefined {
  try {
    return normalize(name);
  } catch {
    return undefined;
  }
}
