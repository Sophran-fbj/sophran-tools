import type { CallNode } from './types';

// 调用树 UI 的纯逻辑（无 React）：默认展开策略与子树问题汇总。
//
// 原则：unknown / 仅签名 / 部分解析 / 畸形 的节点沿着祖先链默认展开——
// "unknown 不等于 safe"，无法识别的调用不能被折叠隐藏；
// 容器上同时给出子树内未知/不完整节点的计数徽章。

const INCOMPLETE_STATUSES = new Set([
  'unknown',
  'signature-only',
  'partial',
  'malformed',
]);

const NOTABLE_WARNING_CODES = new Set([
  'max-depth-reached',
  'max-nodes-reached',
  'max-input-bytes-exceeded',
  'max-array-items-truncated',
  'child-decode-failed',
]);

export interface SubtreeIssues {
  /** 子树（含自身）存在高风险 finding。 */
  highRisk: boolean;
  /** 子树（含自身）中 unknown / signature-only / partial / malformed 节点数。 */
  incomplete: number;
  /** 子树（含自身）存在递归停止的节点。 */
  limitStopped: boolean;
  /** 子树（含自身）存在值得注意的 warning（截断 / 子节点失败等）。 */
  notableWarning: boolean;
}

/** 汇总节点自身与其子树的问题（一次性后序遍历）。 */
export function inspectSubtree(node: CallNode): SubtreeIssues {
  const result: SubtreeIssues = {
    highRisk: node.riskFindings.some((finding) => finding.severity === 'high'),
    incomplete: INCOMPLETE_STATUSES.has(node.decodeStatus) ? 1 : 0,
    limitStopped: node.stopReason !== null,
    notableWarning: node.warnings.some((warning) =>
      NOTABLE_WARNING_CODES.has(warning.code),
    ),
  };
  for (const child of node.children) {
    const childIssues = inspectSubtree(child);
    result.highRisk = result.highRisk || childIssues.highRisk;
    result.incomplete += childIssues.incomplete;
    result.limitStopped = result.limitStopped || childIssues.limitStopped;
    result.notableWarning =
      result.notableWarning || childIssues.notableWarning;
  }
  return result;
}

function hasIssues(issues: SubtreeIssues): boolean {
  return (
    issues.highRisk ||
    issues.incomplete > 0 ||
    issues.limitStopped ||
    issues.notableWarning
  );
}

/**
 * 计算默认展开的节点路径集合：根节点始终展开；此外所有"子树中存在问题
 * （高风险 / 未知或不完整 / 递归停止 / 显著 warning）"的节点及其祖先链
 * 一并展开——unknown 不等于 safe，不能被折叠隐藏。
 */
export function collectDefaultExpandedPaths(root: CallNode): Set<string> {
  const expanded = new Set<string>([root.path]);
  const visit = (node: CallNode): SubtreeIssues => {
    const total: SubtreeIssues = {
      highRisk: node.riskFindings.some((finding) => finding.severity === 'high'),
      incomplete: INCOMPLETE_STATUSES.has(node.decodeStatus) ? 1 : 0,
      limitStopped: node.stopReason !== null,
      notableWarning: node.warnings.some((warning) =>
        NOTABLE_WARNING_CODES.has(warning.code),
      ),
    };
    for (const child of node.children) {
      const childIssues = visit(child);
      if (hasIssues(childIssues)) {
        expanded.add(child.path);
      }
      total.highRisk = total.highRisk || childIssues.highRisk;
      total.incomplete += childIssues.incomplete;
      total.limitStopped = total.limitStopped || childIssues.limitStopped;
      total.notableWarning =
        total.notableWarning || childIssues.notableWarning;
    }
    return total;
  };
  visit(root);
  return expanded;
}
