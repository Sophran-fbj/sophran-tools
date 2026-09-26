import { describe, expect, it } from 'vitest';
import type { Address } from 'viem';
import type { Approval } from './types';
import type { SpenderRisk } from './useSpenderRisk';
import { selectApprovals } from './viewOptions';

const token = '0x0000000000000000000000000000000000000001' as Address;
const known = '0x0000000000000000000000000000000000000002' as Address;
const unknown = '0x0000000000000000000000000000000000000003' as Address;
const malicious = '0x0000000000000000000000000000000000000004' as Address;

function approval(id: string, spender: Address, unlimited: boolean, exposure?: string): Approval {
  return {
    kind: 'erc20', id, token, spender, symbol: id, decimals: 18,
    amountText: '100', atRiskAmountText: exposure, allowance: 100n, unlimited,
  };
}

function risk(level: SpenderRisk['level']): SpenderRisk {
  return {
    level, codeVerified: true, reason: '',
    threat: { status: 'unavailable', sourceName: '', sourceUrl: '', publicDelayDays: 0 },
  };
}

const approvals = [
  approval('known', known, false, '100'),
  approval('unknown', unknown, false),
  approval('malicious', malicious, true, '1'),
];
const risks = {
  [known.toLowerCase()]: risk('known'),
  [unknown.toLowerCase()]: risk('unknown'),
  [malicious.toLowerCase()]: risk('malicious'),
};

describe('approval view options', () => {
  it('shows uncertain and unlimited approvals in the attention filter', () => {
    expect(selectApprovals(approvals, risks, undefined, 'attention', 'risk').map((a) => a.id))
      .toEqual(['malicious', 'unknown']);
    expect(selectApprovals(approvals, undefined, undefined, 'attention', 'risk'))
      .toHaveLength(3);
  });

  it('sorts priced exposure first without treating missing prices as zero risk', () => {
    expect(selectApprovals(approvals, risks, { [token.toLowerCase()]: 2 }, 'all', 'exposure')
      .map((a) => a.id)).toEqual(['known', 'malicious', 'unknown']);
  });

  it('does not mutate the fetched approval order', () => {
    selectApprovals(approvals, risks, undefined, 'all', 'risk');
    expect(approvals.map((a) => a.id)).toEqual(['known', 'unknown', 'malicious']);
  });
});
