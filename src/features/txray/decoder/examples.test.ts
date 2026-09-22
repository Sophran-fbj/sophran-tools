import { describe, expect, it } from 'vitest';
import { buildCallTree } from './call-tree/decode';
import { NESTED_MULTICALL_EXAMPLE } from './examples';

describe('decoder product examples', () => {
  it('keeps the nested multicall sample decodable and risk-bearing', () => {
    const tree = buildCallTree({ data: NESTED_MULTICALL_EXAMPLE });

    expect(tree.nodeCount).toBe(3);
    expect(tree.root.children[0]?.children[0]?.functionName).toBe('approve');
    expect(
      tree.root.children[0]?.children[0]?.riskFindings.some(
        (finding) => finding.severity === 'high',
      ),
    ).toBe(true);
  });
});
