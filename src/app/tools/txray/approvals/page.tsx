'use client';

import { useState } from 'react';
import Link from 'next/link';
import { useAccount, useEnsAddress } from 'wagmi';
import { ConnectButton } from '@rainbow-me/rainbowkit';
import { isAddress, type Address } from 'viem';
import { normalize } from 'viem/ens';

export default function ApprovalsPage() {
  const { address: connected } = useAccount();
  const [input, setInput] = useState('');

  const trimmed = input.trim();
  const looksLikeEns = trimmed.toLowerCase().endsWith('.eth');
  const normalizedEns = looksLikeEns ? safeNormalize(trimmed) : undefined;

  // ENS 解析始终走主网（chainId 1）
  const { data: ensResolved, isLoading: ensLoading } = useEnsAddress({
    name: normalizedEns,
    chainId: 1,
    query: { enabled: !!normalizedEns },
  });

  // 目标地址：优先用输入框（地址或 ENS），留空则用已连接钱包
  let target: Address | undefined;
  let inputError: string | undefined;
  if (trimmed) {
    if (isAddress(trimmed)) target = trimmed as Address;
    else if (looksLikeEns) target = ensResolved ?? undefined;
    else inputError = '请输入合法地址（0x…）或 ENS 域名（xxx.eth）';
  } else {
    target = connected;
  }

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

        <div className="mt-6">
          {target ? (
            <div className="alert">
              <span className="text-sm">
                正在查询：
                <span className="ml-1 break-all font-mono text-primary">
                  {target}
                </span>
                {!trimmed && connected && (
                  <span className="badge badge-sm ml-2">已连接钱包</span>
                )}
              </span>
            </div>
          ) : (
            <div className="alert alert-info">
              <span className="text-sm">
                连接钱包，或在上方粘贴一个地址 / ENS 开始查询。
              </span>
            </div>
          )}
        </div>

        {/* 授权列表占位 —— 下一步 M1：Approval 事件 + multicall + 表格 */}
        <div className="card mt-6 bg-base-200">
          <div className="card-body items-center text-center text-base-content/50">
            <p>授权列表即将到来 —— 下一步接入 Approval 事件 + multicall。</p>
          </div>
        </div>

        <p className="mt-8 text-xs text-base-content/50">
          🔒 只读查询，不会发起任何交易；撤销功能将通过你的钱包签名，本站绝不接触私钥。
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
