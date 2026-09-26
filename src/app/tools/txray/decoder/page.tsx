'use client';

import { useState } from 'react';
import Link from 'next/link';
import { getAddress, isAddress } from 'viem';
import { WalletButton } from '@/components/WalletButton';
import { AppearanceControls } from '@/components/AppearanceControls';
import {
  isMaxUintValue,
  useDecoder,
  type DecodedParam,
  type DecodedResult,
} from '@/features/txray/decoder/useDecoder';
import CallTreeView, { useCallTree } from '@/features/txray/decoder/CallTreeView';
import { getSpenderLabel } from '@/features/txray/approvals/spenderLabels';
import {
  DEFAULT_TXRAY_CHAIN_ID,
  TXRAY_CHAINS,
  explorerAddressUrl,
} from '@/features/txray/chains/chains';
import { useI18n } from '@/lib/i18n/provider';
import {
  APPROVE_EXAMPLE,
  NESTED_MULTICALL_EXAMPLE,
} from '@/features/txray/decoder/examples';

export default function DecoderPage() {
  const { t } = useI18n();
  const [input, setInput] = useState('');
  const [chainId, setChainId] = useState(DEFAULT_TXRAY_CHAIN_ID);
  const { data, isLoading, isError } = useDecoder(input, chainId);
  const value = input.trim();
  const showResult = value.startsWith('0x') && value.length >= 10;

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
              {t.decoder.title}
            </h1>
            <p className="mt-1 text-sm text-base-content/70">
              {t.decoder.description}
            </p>
          </div>
          <div className="flex items-center gap-2 self-end sm:self-auto">
            <AppearanceControls />
            <WalletButton />
          </div>
        </div>

        <div className="form-control mt-8">
          <label className="label" htmlFor="decoder-network">
            <span className="label-text">{t.decoder.network}</span>
          </label>
          <select
            id="decoder-network"
            className="select select-bordered w-full"
            value={chainId}
            onChange={(event) => setChainId(Number(event.target.value))}
          >
            {TXRAY_CHAINS.map((chain) => (
              <option key={chain.id} value={chain.id}>
                {chain.name}
              </option>
            ))}
          </select>
        </div>

        <div className="form-control mt-4">
          <label className="label" htmlFor="decoder-input">
            <span className="label-text">{t.decoder.inputLabel}</span>
            <span className="flex flex-wrap justify-end gap-3">
              <button
                type="button"
                className="link link-primary text-xs"
                onClick={() => setInput(APPROVE_EXAMPLE)}
              >
                {t.decoder.approveSample}
              </button>
              <button
                type="button"
                className="link link-secondary text-xs"
                onClick={() => setInput(NESTED_MULTICALL_EXAMPLE)}
              >
                {t.decoder.callTreeSample}
              </button>
            </span>
          </label>
          <textarea
            id="decoder-input"
            value={input}
            onChange={(event) => setInput(event.target.value)}
            placeholder={t.decoder.placeholder}
            className="textarea textarea-bordered min-h-24 w-full break-all font-mono text-sm"
            spellCheck={false}
          />
        </div>

        {showResult && (
          <div className="mt-6" aria-live="polite">
            {isLoading && (
              <div className="card bg-base-200" role="status">
                <div className="card-body items-center gap-3 text-base-content/70">
                  <span
                    className="loading loading-spinner loading-md text-primary"
                    aria-hidden="true"
                  />
                  <span>{t.decoder.loading}</span>
                </div>
              </div>
            )}

            {isError && (
              <div className="alert alert-error" role="alert">
                <span className="text-sm">{t.decoder.failed}</span>
              </div>
            )}

            {data && <DecodedView data={data} chainId={chainId} />}
          </div>
        )}

        <p className="mt-8 text-xs text-base-content/70">
          {t.decoder.readonly}
        </p>
      </div>
    </main>
  );
}

function DecodedView({ data, chainId }: { data: DecodedResult; chainId: number }) {
  const { t } = useI18n();
  const tree = useCallTree({
    to: data.to,
    value: data.txValue ?? null,
    data: data.raw,
    selector: data.selector,
    signature: data.signature,
  });
  const dangerStyle =
    data.danger === 'high'
      ? 'alert-error'
      : data.danger === 'medium'
        ? 'alert-warning'
        : '';

  return (
    <div className="space-y-4">
      {data.explainKey && (
        <div className={`alert ${dangerStyle}`} role="status">
          <div className="text-sm">
            {data.danger === 'high' && (
              <span className="mr-1 font-bold">{t.decoder.highRisk}</span>
            )}
            {data.danger === 'medium' && (
              <span className="mr-1 font-bold">{t.decoder.caution}</span>
            )}
            {t.decoder.knownExplains[data.explainKey]}
          </div>
        </div>
      )}

      <div className="card bg-base-200">
        <div className="card-body gap-3 p-4 sm:p-6">
          <div>
            <div className="text-xs text-base-content/70">
              {t.decoder.function}
            </div>
            {data.functionName ? (
              <div className="font-mono text-lg text-primary">
                {data.functionName}
              </div>
            ) : (
              <div className="break-words font-mono text-sm text-warning">
                {t.decoder.unknownFunction(data.selector)}
              </div>
            )}
            {data.signature && (
              <div className="mt-1 break-all font-mono text-xs text-base-content/70">
                {data.signature}
              </div>
            )}
          </div>

          {data.to && (
            <div>
              <div className="text-xs text-base-content/70">
                {t.decoder.targetContract}
              </div>
              <AddressLink address={data.to} chainId={chainId} />
            </div>
          )}

          {data.txValue !== undefined && data.txValue !== null && data.txValue !== 0n && (
            <div>
              <div className="text-xs text-base-content/70">
                {t.decoder.tree.value}
              </div>
              <div className="break-all font-mono text-xs">
                {data.txValue.toString()} wei
              </div>
            </div>
          )}

          {data.params.length > 0 && (
            <table className="table table-sm block sm:table">
              <thead className="hidden sm:table-header-group">
                <tr>
                  <th>{t.decoder.parameter}</th>
                  <th>{t.decoder.type}</th>
                  <th>{t.decoder.value}</th>
                </tr>
              </thead>
              <tbody className="block space-y-3 sm:table-row-group sm:space-y-0">
                {data.params.map((param, index) => (
                  <ParamRow
                    key={`${param.name ?? 'arg'}-${index}`}
                    param={param}
                    index={index}
                    chainId={chainId}
                  />
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>

      {/* 树身份 = 链 + 目标 + calldata：切换缓存结果时强制重建组件，
          让默认展开状态（高风险 / 未知路径）对新树重新计算 */}
      <CallTreeView
        key={`${chainId}:${data.to ?? ''}:${data.raw}`}
        tree={tree}
        chainId={chainId}
      />

      <details className="collapse-arrow collapse bg-base-200">
        <summary className="collapse-title text-sm text-base-content/70">
          {t.decoder.rawCalldata}
        </summary>
        <div className="collapse-content">
          <code className="block break-all font-mono text-xs text-base-content/70">
            {data.raw}
          </code>
        </div>
      </details>
    </div>
  );
}

function ParamRow({
  param,
  index,
  chainId,
}: {
  param: DecodedParam;
  index: number;
  chainId: number;
}) {
  const { t } = useI18n();
  const label =
    param.isAddress && isAddress(param.value)
      ? getSpenderLabel(getAddress(param.value), chainId)
      : undefined;
  const isMaxUint = isMaxUintValue(param.type, param.value);

  return (
    <tr className="block rounded-box border border-base-300 p-3 sm:table-row sm:border-0 sm:p-0">
      <td className="block font-mono text-xs sm:table-cell">
        <span className="mr-2 text-base-content/70 sm:hidden">
          {t.decoder.parameter}:
        </span>
        {param.name || `arg${index}`}
      </td>
      <td className="block font-mono text-xs text-base-content/70 sm:table-cell">
        <span className="mr-2 sm:hidden">{t.decoder.type}:</span>
        {param.type}
      </td>
      <td className="block pt-2 sm:table-cell sm:pt-0">
        <span className="mr-2 text-xs text-base-content/70 sm:hidden">
          {t.decoder.value}:
        </span>
        {param.isAddress && isAddress(param.value) ? (
          <span className="inline-flex max-w-full flex-wrap items-center gap-2">
            {label && (
              <span className="badge badge-success badge-sm">{label.name}</span>
            )}
            <AddressLink address={param.value} chainId={chainId} />
          </span>
        ) : isMaxUint ? (
          <span className="badge badge-error badge-sm">
            {t.decoder.unlimited(param.type)}
          </span>
        ) : (
          <span className="break-all font-mono text-xs">{param.value}</span>
        )}
      </td>
    </tr>
  );
}

function AddressLink({ address, chainId }: { address: string; chainId: number }) {
  const { t } = useI18n();
  return (
    <a
      href={explorerAddressUrl(chainId, address)}
      target="_blank"
      rel="noopener noreferrer"
      aria-label={`${t.decoder.targetContract}: ${address}`}
      className="link link-hover rounded-sm break-all font-mono text-xs text-base-content/70 focus-visible:outline focus-visible:outline-2 focus-visible:outline-primary"
    >
      {address}
    </a>
  );
}
