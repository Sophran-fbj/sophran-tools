'use client';

import { useMemo, useState } from 'react';
import Link from 'next/link';
import { LanguageToggle } from '@/components/LanguageToggle';
import { WalletButton } from '@/components/WalletButton';
import { useI18n } from '@/lib/i18n/provider';
import {
  analyzeTypedData,
  type FieldFinding,
  type SignatureAnalysis,
  type SignatureDanger,
  type SignatureRiskKind,
} from '@/features/txray/signature/analyzer';

const EXAMPLE_PERMIT = JSON.stringify(
  {
    domain: {
      name: 'USD Coin',
      version: '2',
      chainId: 1,
      verifyingContract: '0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48',
    },
    primaryType: 'Permit',
    types: {
      EIP712Domain: [
        { name: 'name', type: 'string' },
        { name: 'version', type: 'string' },
        { name: 'chainId', type: 'uint256' },
        { name: 'verifyingContract', type: 'address' },
      ],
      Permit: [
        { name: 'owner', type: 'address' },
        { name: 'spender', type: 'address' },
        { name: 'value', type: 'uint256' },
        { name: 'nonce', type: 'uint256' },
        { name: 'deadline', type: 'uint256' },
      ],
    },
    message: {
      owner: '0xFb3C2B2769A2119f349233A44A640F090C907667',
      spender: '0xE592427A0AEce92De3Edee1F18E0157C05861564',
      value:
        '115792089237316195423570985008687907853269984665640564039457584007913129639935',
      nonce: '8',
      deadline: '4102444800',
    },
  },
  null,
  2,
);

const EXAMPLE_PERMIT2 = JSON.stringify(
  {
    domain: {
      name: 'Permit2',
      chainId: 1,
      verifyingContract: '0x000000000022D473030F116dDEE9F6B43aC78BA3',
    },
    primaryType: 'PermitSingle',
    types: {
      PermitDetails: [
        { name: 'token', type: 'address' },
        { name: 'amount', type: 'uint160' },
        { name: 'expiration', type: 'uint48' },
        { name: 'nonce', type: 'uint48' },
      ],
      PermitSingle: [
        { name: 'details', type: 'PermitDetails' },
        { name: 'spender', type: 'address' },
        { name: 'sigDeadline', type: 'uint256' },
      ],
    },
    message: {
      details: {
        token: '0xA0b86991c6218b36c1d19D4a2e9Eb0cE3606eB48',
        amount: '1461501637330902918203684832716283019655932542975',
        expiration: '4102444800',
        nonce: '12',
      },
      spender: '0xEf1c6E67703c7BD7107eed8303Fbe6EC2554BF6B',
      sigDeadline: '4102444800',
    },
  },
  null,
  2,
);

export default function SignaturePage() {
  const { t } = useI18n();
  const [input, setInput] = useState('');

  const result = useMemo<
    | { status: 'idle' }
    | { status: 'ok'; data: SignatureAnalysis }
    | { status: 'error'; error: string }
  >(() => {
    const value = input.trim();
    if (!value) return { status: 'idle' };

    try {
      return { status: 'ok', data: analyzeTypedData(value) };
    } catch (e) {
      return {
        status: 'error',
        error: e instanceof Error ? e.message : t.signature.failed,
      };
    }
  }, [input, t.signature.failed]);

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
            <h1 className="mt-2 text-3xl font-bold text-primary">
              {t.signature.title}
            </h1>
            <p className="mt-1 text-sm text-base-content/60">{t.signature.desc}</p>
          </div>
          <div className="flex items-center gap-3">
            <LanguageToggle />
            <WalletButton />
          </div>
        </div>

        <div className="alert alert-warning mt-8 text-sm">
          <span>{t.signature.readonly}</span>
        </div>

        <div className="form-control mt-6">
          <label className="label">
            <span className="label-text">{t.signature.inputLabel}</span>
            <span className="flex gap-2">
              <button
                className="link link-primary text-xs"
                onClick={() => setInput(EXAMPLE_PERMIT)}
              >
                {t.signature.permitSample}
              </button>
              <button
                className="link link-secondary text-xs"
                onClick={() => setInput(EXAMPLE_PERMIT2)}
              >
                {t.signature.permit2Sample}
              </button>
            </span>
          </label>
          <textarea
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder={t.signature.placeholder}
            className="textarea textarea-bordered min-h-72 w-full break-all font-mono text-xs"
            spellCheck={false}
          />
        </div>

        <div className="mt-6">
          {result.status === 'idle' && (
            <div className="card bg-base-200">
              <div className="card-body text-sm text-base-content/60">
                {t.signature.idle}
              </div>
            </div>
          )}
          {result.status === 'error' && (
            <div className="alert alert-error text-sm">{result.error}</div>
          )}
          {result.status === 'ok' && <AnalysisView data={result.data} />}
        </div>
      </div>
    </main>
  );
}

function AnalysisView({ data }: { data: SignatureAnalysis }) {
  const { t } = useI18n();

  return (
    <div className="space-y-4">
      <div className={`alert ${dangerClass(data.danger)}`}>
        <div>
          <div className="font-bold">{riskTitle(t, data.riskKind)}</div>
          <div className="text-sm">{riskExplain(t, data.riskKind)}</div>
        </div>
      </div>

      <div className="grid gap-3 md:grid-cols-3">
        <InfoCard label={t.signature.domain} value={data.domainName ?? t.signature.unknown} />
        <InfoCard label={t.signature.primaryType} value={data.primaryType ?? t.signature.unknown} />
        <InfoCard
          label={t.signature.verifyingContract}
          value={data.verifyingContract ?? t.signature.notProvided}
          mono
        />
      </div>

      <div className="card bg-base-200">
        <div className="card-body">
          <h2 className="card-title text-lg">{t.signature.fields}</h2>
          {data.findings.length === 0 ? (
            <p className="text-sm text-base-content/60">
              {t.signature.noFields}
            </p>
          ) : (
            <div className="overflow-x-auto">
              <table className="table table-sm">
                <thead>
                  <tr>
                    <th>{t.signature.field}</th>
                    <th>{t.signature.value}</th>
                    <th>{t.signature.why}</th>
                  </tr>
                </thead>
                <tbody>
                  {data.findings.map((finding, index) => (
                    <FindingRow finding={finding} key={`${finding.label}-${index}`} />
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>

      <details className="collapse-arrow collapse bg-base-200">
        <summary className="collapse-title text-sm text-base-content/70">
          {t.signature.rawMessage}
        </summary>
        <div className="collapse-content">
          <pre className="overflow-x-auto whitespace-pre-wrap break-all font-mono text-xs text-base-content/60">
            {JSON.stringify(data.rawMessage, null, 2)}
          </pre>
        </div>
      </details>
    </div>
  );
}

function FindingRow({ finding }: { finding: FieldFinding }) {
  const { locale, t } = useI18n();

  return (
    <tr>
      <td>
        <span className={`badge badge-sm ${badgeClass(finding.severity)}`}>
          {t.signature.findingLabels[finding.kind]}
        </span>
      </td>
      <td className="max-w-sm break-all font-mono text-xs">{finding.value}</td>
      <td className="text-sm text-base-content/70">
        {finding.kind === 'amount' && finding.severity === 'high'
          ? `${t.signature.findingExplains.amount} ${
              locale === 'zh'
                ? '无限额度意味着 spender 可能在授权有效期内移动全部余额。'
                : 'Unlimited amount means the spender may move the full balance while the approval remains valid.'
            }`
          : t.signature.findingExplains[finding.kind]}
      </td>
    </tr>
  );
}

function InfoCard({
  label,
  value,
  mono,
}: {
  label: string;
  value: string;
  mono?: boolean;
}) {
  return (
    <div className="card bg-base-200">
      <div className="card-body gap-1 p-4">
        <div className="text-xs text-base-content/50">{label}</div>
        <div className={mono ? 'break-all font-mono text-xs' : 'text-sm'}>{value}</div>
      </div>
    </div>
  );
}

function dangerClass(danger: SignatureDanger): string {
  if (danger === 'high') return 'alert-error';
  if (danger === 'medium') return 'alert-warning';
  if (danger === 'low') return 'alert-info';
  return '';
}

function badgeClass(danger: SignatureDanger): string {
  if (danger === 'high') return 'badge-error';
  if (danger === 'medium') return 'badge-warning';
  if (danger === 'low') return 'badge-info';
  return 'badge-ghost';
}

function riskTitle(t: ReturnType<typeof useI18n>['t'], kind: SignatureRiskKind) {
  if (kind === 'erc20-permit') return t.signature.riskTitles.erc20Permit;
  if (kind === 'nft-order') return t.signature.riskTitles.nftOrder;
  return t.signature.riskTitles[kind];
}

function riskExplain(t: ReturnType<typeof useI18n>['t'], kind: SignatureRiskKind) {
  if (kind === 'erc20-permit') return t.signature.riskExplains.erc20Permit;
  if (kind === 'nft-order') return t.signature.riskExplains.nftOrder;
  return t.signature.riskExplains[kind];
}
