'use client';

import { useState } from 'react';
import Link from 'next/link';
import { WalletButton } from '@/components/WalletButton';
import {
  useDecoder,
  type DecodedParam,
  type DecodedResult,
} from '@/features/txray/decoder/useDecoder';
import { getSpenderLabel } from '@/features/txray/approvals/spenderLabels';
import { isAddress, type Address } from 'viem';

// 示例：approve 无限额度给 Uniswap V3 Router（命中本地标签 + 危险解释）
const EXAMPLE =
  '0x095ea7b3000000000000000000000000e592427a0aece92de3edee1f18e0157c05861564ffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffffff';

export default function DecoderPage() {
  const [input, setInput] = useState('');
  const { data, isLoading, isError, error } = useDecoder(input);
  const value = input.trim();
  const showResult = value.startsWith('0x') && value.length >= 10;

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
            <h1 className="mt-2 text-3xl font-bold text-primary">交易解码</h1>
            <p className="mt-1 text-sm text-base-content/60">
              粘贴 calldata 或交易 hash，看清它在干什么
            </p>
          </div>
          <WalletButton />
        </div>

        <div className="form-control mt-8">
          <label className="label">
            <span className="label-text">calldata 或 tx hash</span>
            <button
              className="link link-primary text-xs"
              onClick={() => setInput(EXAMPLE)}
            >
              试试示例
            </button>
          </label>
          <textarea
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder="0x095ea7b3… 或 0x 开头的 64 位交易哈希"
            className="textarea textarea-bordered min-h-24 w-full break-all font-mono text-sm"
            spellCheck={false}
          />
        </div>

        {showResult && (
          <div className="mt-6">
            {isLoading && (
              <div className="card bg-base-200">
                <div className="card-body items-center gap-3 text-base-content/60">
                  <span className="loading loading-spinner loading-md text-primary" />
                  <span>解码中…</span>
                </div>
              </div>
            )}

            {isError && (
              <div className="alert alert-error">
                <span className="text-sm">{(error as Error)?.message ?? '解码失败'}</span>
              </div>
            )}

            {data && <DecodedView data={data} />}
          </div>
        )}

        <p className="mt-8 text-xs text-base-content/50">
          🔒 解码是纯只读操作，不会发起任何交易。
        </p>
      </div>
    </main>
  );
}

function DecodedView({ data }: { data: DecodedResult }) {
  const dangerStyle =
    data.danger === 'high'
      ? 'alert-error'
      : data.danger === 'medium'
        ? 'alert-warning'
        : '';

  return (
    <div className="space-y-4">
      {/* 危险/解释横幅 */}
      {data.explain && (
        <div className={`alert ${dangerStyle}`}>
          <div className="text-sm">
            {data.danger === 'high' && <span className="mr-1 font-bold">⚠️ 高风险</span>}
            {data.danger === 'medium' && <span className="mr-1 font-bold">注意</span>}
            {data.explain}
          </div>
        </div>
      )}

      {/* 函数 */}
      <div className="card bg-base-200">
        <div className="card-body gap-3">
          <div>
            <div className="text-xs text-base-content/50">函数</div>
            {data.functionName ? (
              <div className="font-mono text-lg text-primary">{data.functionName}</div>
            ) : (
              <div className="font-mono text-sm text-warning">
                未知函数（选择器 {data.selector}，签名库未收录）
              </div>
            )}
            {data.signature && (
              <div className="mt-1 break-all font-mono text-xs text-base-content/60">
                {data.signature}
              </div>
            )}
          </div>

          {data.to && (
            <div>
              <div className="text-xs text-base-content/50">目标合约</div>
              <AddrLink addr={data.to} />
            </div>
          )}

          {data.params.length > 0 && (
            <div className="overflow-x-auto">
              <table className="table table-sm">
                <thead>
                  <tr>
                    <th>参数</th>
                    <th>类型</th>
                    <th>值</th>
                  </tr>
                </thead>
                <tbody>
                  {data.params.map((p, i) => (
                    <ParamRow key={i} p={p} index={i} />
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>

      {/* 原始 calldata */}
      <details className="collapse-arrow collapse bg-base-200">
        <summary className="collapse-title text-sm text-base-content/70">
          原始 calldata
        </summary>
        <div className="collapse-content">
          <code className="block break-all font-mono text-xs text-base-content/60">
            {data.raw}
          </code>
        </div>
      </details>
    </div>
  );
}

function ParamRow({ p, index }: { p: DecodedParam; index: number }) {
  const label =
    p.isAddress && isAddress(p.value) ? getSpenderLabel(p.value as Address) : undefined;
  const isMaxUint = p.type.startsWith('uint') && /^115792089237316195423570985008687907853269984665640564039457584007913129639935$/.test(p.value);

  return (
    <tr>
      <td className="font-mono text-xs">{p.name || `arg${index}`}</td>
      <td className="font-mono text-xs text-base-content/60">{p.type}</td>
      <td>
        {p.isAddress && isAddress(p.value) ? (
          <div className="flex items-center gap-2">
            {label && <span className="badge badge-success badge-sm">{label.name}</span>}
            <AddrLink addr={p.value} />
          </div>
        ) : isMaxUint ? (
          <span className="badge badge-error badge-sm">无限（max uint256）</span>
        ) : (
          <span className="break-all font-mono text-xs">{p.value}</span>
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
      {addr}
    </a>
  );
}
