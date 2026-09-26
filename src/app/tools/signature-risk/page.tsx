'use client';

import { useState } from 'react';
import Link from 'next/link';
import { AppearanceControls } from '@/components/AppearanceControls';
import { WalletButton } from '@/components/WalletButton';
import { useI18n } from '@/lib/i18n/provider';
import {
  analyzeTypedData,
  type FieldFinding,
  type SignatureAnalysis,
  type SignatureDanger,
  type SignatureRiskKind,
} from '@/features/signature-risk/analyzer';

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
  const copy = t.signatureRisk;
  const [input, setInput] = useState('');
  const [result, setResult] = useState<
    | { status: 'idle' }
    | { status: 'ok'; data: SignatureAnalysis }
    | { status: 'error'; error: string }
  >({ status: 'idle' });

  function runAnalysis(value: string) {
    const trimmed = value.trim();
    if (!trimmed) {
      setResult({ status: 'idle' });
      return;
    }
    try {
      JSON.parse(trimmed);
    } catch {
      setResult({ status: 'error', error: copy.invalidJson });
      return;
    }
    try {
      setResult({ status: 'ok', data: analyzeTypedData(trimmed) });
    } catch {
      setResult({
        status: 'error',
        error: copy.invalidTypedData,
      });
    }
  }

  function loadSample(value: string) {
    setInput(value);
    runAnalysis(value);
  }

  return (
    <main className="min-h-screen bg-base-100 px-6 py-12">
      <div className="mx-auto max-w-4xl">
        <div className="flex items-start justify-between gap-4">
          <div>
            <Link
              href="/"
              className="text-sm text-base-content/60 hover:text-base-content"
            >
              ← {t.common.backHome}
            </Link>
            <h1 className="mt-2 text-3xl font-bold text-primary">
              {copy.title}
            </h1>
            <p className="mt-1 text-sm text-base-content/60">{copy.desc}</p>
          </div>
          <div className="flex items-center gap-3">
            <AppearanceControls />
            <WalletButton />
          </div>
        </div>

        <div className="alert alert-warning mt-8 text-sm">
          <span>{copy.readonly}</span>
        </div>

        <details className="collapse-arrow collapse mt-4 bg-base-200 text-sm">
          <summary className="collapse-title font-medium">{copy.howToGetTitle}</summary>
          <div className="collapse-content space-y-2 text-base-content/70">
            <p>{copy.howToGet}</p>
            <p>{copy.cannotReadPopup}</p>
          </div>
        </details>

        <div className="form-control mt-6">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <label className="label" htmlFor="typed-data-input">
              <span className="label-text">{copy.inputLabel}</span>
            </label>
            <div className="flex gap-2">
              <button
                type="button"
                className="link link-primary text-xs"
                onClick={() => loadSample(EXAMPLE_PERMIT)}
              >
                {copy.permitSample}
              </button>
              <button
                type="button"
                className="link link-secondary text-xs"
                onClick={() => loadSample(EXAMPLE_PERMIT2)}
              >
                {copy.permit2Sample}
              </button>
            </div>
          </div>
          <textarea
            id="typed-data-input"
            value={input}
            onChange={(e) => {
              setInput(e.target.value);
              setResult({ status: 'idle' });
            }}
            placeholder={copy.placeholder}
            className="textarea textarea-bordered min-h-72 w-full break-all font-mono text-xs"
            spellCheck={false}
            aria-describedby="typed-data-help"
          />
          <p id="typed-data-help" className="mt-2 text-xs text-base-content/70">
            {copy.inputHelp}
          </p>
        </div>
        <div className="mt-4 flex justify-end">
          <button
            type="button"
            className="btn btn-primary btn-sm"
            onClick={() => runAnalysis(input)}
          >
            {copy.analyze}
          </button>
        </div>

        <div className="mt-6">
          {result.status === 'idle' && (
            <div className="card bg-base-200">
              <div className="card-body text-sm text-base-content/60">
                {copy.idle}
              </div>
            </div>
          )}
          {result.status === 'error' && (
            <div className="alert alert-error text-sm" role="alert">{result.error}</div>
          )}
          {result.status === 'ok' && <AnalysisView data={result.data} />}
        </div>
      </div>
    </main>
  );
}

function AnalysisView({ data }: { data: SignatureAnalysis }) {
  const { t } = useI18n();
  const copy = t.signatureRisk;

  return (
    <div className="space-y-4">
      {!data.schemaValidated && (
        <div className="alert alert-warning text-sm" role="status">
          {copy.schemaFallback}
        </div>
      )}

      <div className={`alert ${dangerClass(data.danger)}`}>
        <div>
          <div className="font-bold">{riskTitle(t, data.riskKind)}</div>
          <div className="text-sm">
            {riskExplain(t, data.riskKind)}
            {data.signatureExpired && (
              <p className="mt-2">{copy.expiredExplain}</p>
            )}
          </div>
        </div>
      </div>

      <div className="grid gap-3 md:grid-cols-4">
        <InfoCard label={copy.domain} value={data.domainName ?? copy.unknown} />
        <InfoCard label={copy.chainId} value={data.chainId ?? copy.notProvided} />
        <InfoCard label={copy.primaryType} value={data.primaryType ?? copy.unknown} />
        <InfoCard
          label={copy.verifyingContract}
          value={data.verifyingContract ?? copy.notProvided}
          mono
        />
      </div>

      <div className="card bg-base-200">
        <div className="card-body">
          <h2 className="card-title text-lg">{copy.fields}</h2>
          {data.findings.length === 0 ? (
            <p className="text-sm text-base-content/60">
              {copy.noFields}
            </p>
          ) : (
            <div className="overflow-x-auto">
              <table className="table table-sm">
                <thead>
                  <tr>
                    <th>{copy.field}</th>
                    <th>{copy.value}</th>
                    <th>{copy.why}</th>
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
          {copy.rawMessage}
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
  const { t } = useI18n();
  const copy = t.signatureRisk;

  return (
    <tr>
      <td>
        <span className={`badge badge-sm ${badgeClass(finding.severity)}`}>
          {copy.findingLabels[finding.kind]}
        </span>
        {finding.path && (
          <div className="mt-1 font-mono text-xs text-base-content/50">{finding.path}</div>
        )}
      </td>
      <td className="max-w-sm break-all font-mono text-xs">{finding.value}</td>
      <td className="text-sm text-base-content/70">
        {finding.kind === 'amount' && finding.severity === 'high'
          ? `${copy.findingExplains.amount} ${copy.findingExplains.amountUnlimited}`
          : copy.findingExplains[finding.kind]}
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
  const copy = t.signatureRisk;
  if (kind === 'erc20-permit') return copy.riskTitles.erc20Permit;
  if (kind === 'nft-order') return copy.riskTitles.nftOrder;
  return copy.riskTitles[kind];
}

function riskExplain(t: ReturnType<typeof useI18n>['t'], kind: SignatureRiskKind) {
  const copy = t.signatureRisk;
  if (kind === 'erc20-permit') return copy.riskExplains.erc20Permit;
  if (kind === 'nft-order') return copy.riskExplains.nftOrder;
  return copy.riskExplains[kind];
}
