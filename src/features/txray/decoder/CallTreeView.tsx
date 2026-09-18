'use client';

import { useMemo, useState } from 'react';
import { getAddress, isAddress } from 'viem';
import { buildCallTree, subtreeHasHighRisk } from './call-tree/decode';
import type {
  CallNode,
  CallTreeResult,
  DecodeStatus,
  RiskFinding,
  RiskSeverity,
  StructuredWarning,
} from './call-tree/types';
import { getSpenderLabel } from '@/features/txray/approvals/spenderLabels';
import { explorerAddressUrl } from '@/features/txray/chains/chains';
import { useI18n } from '@/lib/i18n/provider';

// 调用树展示：可折叠层级 + 高风险路径默认展开 + 键盘可达 + 双语。
// 所有风险措辞都是"发现/建议核实"，不做安全或恶意判断。

interface CallTreeViewProps {
  to?: string;
  value?: bigint | null;
  data: string;
  selector: string;
  signature: string | null;
}

const DEFAULT_EXPAND_WARNING_CODES = new Set([
  'max-depth-reached',
  'max-nodes-reached',
  'max-input-bytes-exceeded',
  'max-array-items-truncated',
  'child-decode-failed',
]);

function collectDefaultExpanded(
  node: CallNode,
  expanded: Set<string>,
): boolean {
  const subtreeHighRisk = subtreeHasHighRisk(node);
  let subtreeLimitStop = node.stopReason !== null;
  for (const child of node.children) {
    if (collectDefaultExpanded(child, expanded)) {
      subtreeLimitStop = true;
    }
  }
  const selfNotable =
    subtreeHighRisk ||
    node.stopReason !== null ||
    node.warnings.some((warning) => DEFAULT_EXPAND_WARNING_CODES.has(warning.code));
  // 展开所有"值得注意"节点的祖先链（含 notable 节点自身）。
  if (selfNotable || subtreeLimitStop) {
    expanded.add(node.path);
  }
  return selfNotable || subtreeLimitStop;
}

export function useCallTree(props: CallTreeViewProps): CallTreeResult {
  return useMemo(
    () =>
      buildCallTree(
        {
          to: props.to ?? null,
          value: props.value ?? null,
          data: props.data,
        },
        {
          signatures: props.signature ? { [props.selector]: props.signature } : {},
        },
      ),
    [props.to, props.value, props.data, props.selector, props.signature],
  );
}

export default function CallTreeView({
  tree,
  chainId,
}: {
  tree: CallTreeResult;
  chainId: number;
}) {
  const { t } = useI18n();
  const [expanded, setExpanded] = useState<Set<string>>(() => {
    const initial = new Set<string>();
    collectDefaultExpanded(tree.root, initial);
    return initial;
  });

  const toggle = (path: string): void => {
    setExpanded((previous) => {
      const next = new Set(previous);
      if (next.has(path)) {
        next.delete(path);
      } else {
        next.add(path);
      }
      return next;
    });
  };

  const expandAll = (): void => {
    const all = new Set<string>();
    const visit = (node: CallNode): void => {
      if (node.children.length > 0) all.add(node.path);
      node.children.forEach(visit);
    };
    visit(tree.root);
    setExpanded(all);
  };

  const onKeyDown = (event: React.KeyboardEvent): void => {
    const target = event.target as HTMLElement;
    const path = target.dataset.treePath;
    if (!path) return;
    const findNode = (node: CallNode): CallNode | null => {
      if (node.path === path) return node;
      for (const child of node.children) {
        const found = findNode(child);
        if (found) return found;
      }
      return null;
    };
    const node = findNode(tree.root);
    if (!node || node.children.length === 0) return;
    if (event.key === 'ArrowRight' && !expanded.has(path)) {
      event.preventDefault();
      toggle(path);
    } else if (event.key === 'ArrowLeft' && expanded.has(path)) {
      event.preventDefault();
      toggle(path);
    }
  };

  return (
    <section className="card bg-base-200" aria-label={t.decoder.tree.title}>
      <div className="card-body gap-3 p-4 sm:p-6">
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h2 className="text-lg font-bold text-primary">
              {t.decoder.tree.title}
            </h2>
            <span className="text-xs text-base-content/70">
              {t.decoder.tree.nodeCount(tree.nodeCount)}
            </span>
          </div>
          <div className="flex gap-2">
            <button
              type="button"
              className="btn btn-xs btn-ghost"
              onClick={expandAll}
            >
              {t.decoder.tree.expandAll}
            </button>
            <button
              type="button"
              className="btn btn-xs btn-ghost"
              onClick={() => setExpanded(new Set())}
            >
              {t.decoder.tree.collapseAll}
            </button>
          </div>
        </div>

        <p
          className="rounded-box bg-base-300/60 px-3 py-2 text-xs text-base-content/80"
          data-testid="static-decode-notice"
        >
          ℹ️ {t.decoder.tree.staticNotice}
        </p>

        <ul role="tree" className="space-y-1" onKeyDown={onKeyDown}>
          <TreeNodeView
            node={tree.root}
            chainId={chainId}
            expanded={expanded}
            onToggle={toggle}
          />
        </ul>
      </div>
    </section>
  );
}

function TreeNodeView({
  node,
  chainId,
  expanded,
  onToggle,
}: {
  node: CallNode;
  chainId: number;
  expanded: Set<string>;
  onToggle: (path: string) => void;
}) {
  const { t } = useI18n();
  const hasChildren = node.children.length > 0;
  const isOpen = expanded.has(node.path);
  const highRiskCount = node.riskFindings.filter(
    (finding) => finding.severity === 'high',
  ).length;

  return (
    <li
      role="treeitem"
      aria-expanded={hasChildren ? isOpen : undefined}
      aria-selected={false}
      aria-level={node.depth + 1}
      data-testid="call-node"
      data-node-path={node.path}
      className={`rounded-box ${node.depth === 0 ? '' : 'border-l-2 border-base-300'}`}
      style={node.depth === 0 ? undefined : { marginLeft: '0.5rem', paddingLeft: '0.5rem' }}
    >
      <div className="flex flex-wrap items-center gap-x-2 gap-y-1 py-0.5">
        {hasChildren ? (
          <button
            type="button"
            className="rounded-sm px-1 text-base-content/70 hover:text-base-content focus-visible:outline focus-visible:outline-2 focus-visible:outline-primary"
            aria-expanded={isOpen}
            aria-label={`${isOpen ? t.decoder.tree.collapse : t.decoder.tree.expand}: ${nodeLabel(node)}`}
            data-tree-path={node.path}
            data-testid="node-toggle"
            onClick={() => onToggle(node.path)}
          >
            {isOpen ? '▾' : '▸'}
          </button>
        ) : (
          <span aria-hidden="true" className="px-1 text-base-content/30">
            ·
          </span>
        )}

        {node.container && (
          <span className="badge badge-outline badge-sm break-all">
            {t.decoder.tree.containers[node.container.kind]}
          </span>
        )}
        {node.functionName && (
          <span className="break-all font-mono text-xs font-bold text-primary">
            {node.functionName}
          </span>
        )}
        {!node.functionName && node.selector && (
          <span className="break-all font-mono text-xs text-warning">
            {t.decoder.tree.selector} {node.selector}
          </span>
        )}
        <StatusBadge status={node.decodeStatus} />

        {node.target && <TargetView node={node} chainId={chainId} />}
        {!node.target && (
          <span className="break-all font-mono text-xs text-base-content/50">
            {t.decoder.tree.unknownTarget}
          </span>
        )}
        {node.value && node.value !== '0' && (
          <span className="break-all font-mono text-xs">
            {t.decoder.tree.value}: {node.value} wei
          </span>
        )}
        {node.allowFailure === true && (
          <span className="badge badge-ghost badge-sm">
            {t.decoder.tree.riskTitles['subcall-allow-failure']}
          </span>
        )}
        {highRiskCount > 0 && (
          <span
            className="badge badge-error badge-sm"
            data-testid="high-risk-badge"
          >
            ⚠ {highRiskCount}
          </span>
        )}
      </div>

      {node.riskFindings.length > 0 && (
        <ul className="mb-1 ml-6 space-y-1" aria-label={t.decoder.tree.status}>
          {node.riskFindings.map((finding, index) => (
            <RiskFindingView key={`${finding.code}-${index}`} finding={finding} />
          ))}
        </ul>
      )}

      {node.warnings.length > 0 && (
        <ul className="mb-1 ml-6 space-y-0.5">
          {node.warnings.map((warning, index) => (
            <li
              key={`${warning.code}-${index}`}
              className="text-xs text-base-content/60"
            >
              ⓘ <WarningText warning={warning} />
            </li>
          ))}
        </ul>
      )}

      {node.stopReason && (
        <p
          className="mb-1 ml-6 rounded-box bg-warning/10 px-2 py-1 text-xs text-base-content/80"
          data-testid="stop-reason"
        >
          ⏹ {t.decoder.tree.stopReasons[node.stopReason]}
        </p>
      )}

      {node.userOp?.factory && (
        <p className="ml-6 break-all font-mono text-xs text-base-content/70">
          {t.decoder.tree.userOp.factory}: {node.userOp.factory}
        </p>
      )}
      {node.userOp?.paymaster && (
        <p className="ml-6 break-all font-mono text-xs text-base-content/70">
          {t.decoder.tree.userOp.paymaster}: {node.userOp.paymaster}
        </p>
      )}

      {node.container?.note && (
        <p className="ml-6 text-xs text-base-content/60">
          {t.decoder.tree.identificationNotes[node.container.note]}
        </p>
      )}
      {node.container && (
        <p className="ml-6 text-xs text-base-content/50">
          {t.decoder.tree.identification[node.container.identification]}
          {node.container.version
            ? ` · ${t.decoder.tree.userOp.versionLabel} ${node.container.version}`
            : ''}
        </p>
      )}

      {!hasChildren && node.decodeStatus === 'unknown' && (
        <details className="ml-6">
          <summary className="cursor-pointer text-xs text-base-content/60">
            {t.decoder.tree.rawPreview}
          </summary>
          <code className="block break-all font-mono text-xs text-base-content/60">
            {node.rawPreview}
          </code>
        </details>
      )}

      {hasChildren && isOpen && (
        <ul role="group" className="space-y-1 pb-1">
          {node.children.map((child) => (
            <TreeNodeView
              key={child.id}
              node={child}
              chainId={chainId}
              expanded={expanded}
              onToggle={onToggle}
            />
          ))}
        </ul>
      )}
    </li>
  );
}

function nodeLabel(node: CallNode): string {
  return node.functionName ?? node.selector ?? node.path;
}

function StatusBadge({ status }: { status: DecodeStatus }) {
  const { t } = useI18n();
  const style: Record<DecodeStatus, string> = {
    decoded: 'badge-success',
    'signature-only': 'badge-warning',
    partial: 'badge-warning',
    unknown: 'badge-ghost',
    'recursion-stopped': 'badge-info',
    malformed: 'badge-error',
  };
  return (
    <span
      className={`badge badge-sm ${style[status]}`}
      data-testid="node-status"
      data-status={status}
    >
      {t.decoder.tree.statusLabels[status]}
    </span>
  );
}

function TargetView({ node, chainId }: { node: CallNode; chainId: number }) {
  const { t } = useI18n();
  const target = node.target;
  if (!target || !isAddress(target)) return null;
  const checksummed = getAddress(target);
  const label = getSpenderLabel(checksummed, chainId);
  return (
    <span className="inline-flex max-w-full flex-wrap items-center gap-1">
      {label && <span className="badge badge-success badge-sm">{label.name}</span>}
      <a
        href={explorerAddressUrl(chainId, checksummed)}
        target="_blank"
        rel="noopener noreferrer"
        aria-label={`${t.decoder.tree.target}: ${checksummed}`}
        className="break-all font-mono text-xs text-base-content/70 hover:text-base-content"
      >
        {checksummed}
      </a>
    </span>
  );
}

const SEVERITY_STYLE: Record<RiskSeverity, string> = {
  high: 'border-error/60 bg-error/10 text-error',
  medium: 'border-warning/60 bg-warning/10 text-warning',
  low: 'border-base-300 bg-base-200',
  info: 'border-base-300 bg-base-200',
};

function RiskFindingView({ finding }: { finding: RiskFinding }) {
  const { t } = useI18n();
  return (
    <li
      className={`rounded-box border px-2 py-1 text-xs ${SEVERITY_STYLE[finding.severity]}`}
      data-testid="risk-finding"
      data-risk-code={finding.code}
      data-severity={finding.severity}
    >
      <span className="font-bold">
        {finding.severity === 'high' ? '⚠ ' : ''}
        {t.decoder.tree.riskTitles[finding.code]}
      </span>
      <span className="text-base-content/70">
        {' '}
        — {t.decoder.tree.riskExplains[finding.code]}
      </span>
      <span className="ml-1 text-base-content/40">[{finding.nodePath}]</span>
    </li>
  );
}

function WarningText({ warning }: { warning: StructuredWarning }) {
  const { t } = useI18n();
  return <span>{t.decoder.tree.warnings[warning.code]}</span>;
}
