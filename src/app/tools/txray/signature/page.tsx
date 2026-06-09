'use client';

import { useMemo, useState } from 'react';
import Link from 'next/link';
import { ConnectButton } from '@rainbow-me/rainbowkit';
import {
  analyzeTypedData,
  type FieldFinding,
  type SignatureAnalysis,
  type SignatureDanger,
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
        error: e instanceof Error ? e.message : 'Failed to analyze signature.',
      };
    }
  }, [input]);

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
              Signature decoder
            </h1>
            <p className="mt-1 text-sm text-base-content/60">
              Paste EIP-712 typed data and inspect what a signature can authorize.
            </p>
          </div>
          <ConnectButton />
        </div>

        <div className="alert alert-warning mt-8 text-sm">
          <span>
            This is read-only analysis. TxRay will never ask you to sign the
            pasted payload. Treat unknown signature requests as hostile until you
            understand the spender, amount, and deadline.
          </span>
        </div>

        <div className="form-control mt-6">
          <label className="label">
            <span className="label-text">Typed-data JSON</span>
            <span className="flex gap-2">
              <button
                className="link link-primary text-xs"
                onClick={() => setInput(EXAMPLE_PERMIT)}
              >
                ERC-20 permit sample
              </button>
              <button
                className="link link-secondary text-xs"
                onClick={() => setInput(EXAMPLE_PERMIT2)}
              >
                Permit2 sample
              </button>
            </span>
          </label>
          <textarea
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder='{"domain":{...},"primaryType":"Permit","message":{...},"types":{...}}'
            className="textarea textarea-bordered min-h-72 w-full break-all font-mono text-xs"
            spellCheck={false}
          />
        </div>

        <div className="mt-6">
          {result.status === 'idle' && (
            <div className="card bg-base-200">
              <div className="card-body text-sm text-base-content/60">
                Paste a signTypedData payload, or click a sample to see how TxRay
                explains risky approvals.
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
  return (
    <div className="space-y-4">
      <div className={`alert ${dangerClass(data.danger)}`}>
        <div>
          <div className="font-bold">{data.title}</div>
          <div className="text-sm">{data.explain}</div>
        </div>
      </div>

      <div className="grid gap-3 md:grid-cols-3">
        <InfoCard label="Domain" value={data.domainName ?? 'Unknown'} />
        <InfoCard label="Primary type" value={data.primaryType ?? 'Unknown'} />
        <InfoCard
          label="Verifying contract"
          value={data.verifyingContract ?? 'Not provided'}
          mono
        />
      </div>

      <div className="card bg-base-200">
        <div className="card-body">
          <h2 className="card-title text-lg">Security-relevant fields</h2>
          {data.findings.length === 0 ? (
            <p className="text-sm text-base-content/60">
              No common permit or operator fields were detected. Inspect the raw
              message before signing.
            </p>
          ) : (
            <div className="overflow-x-auto">
              <table className="table table-sm">
                <thead>
                  <tr>
                    <th>Field</th>
                    <th>Value</th>
                    <th>Why it matters</th>
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
          Raw message
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
  return (
    <tr>
      <td>
        <span className={`badge badge-sm ${badgeClass(finding.severity)}`}>
          {finding.label}
        </span>
      </td>
      <td className="max-w-sm break-all font-mono text-xs">{finding.value}</td>
      <td className="text-sm text-base-content/70">{finding.explain}</td>
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
