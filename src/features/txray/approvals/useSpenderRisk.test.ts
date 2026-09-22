import { describe, expect, it } from 'vitest';
import {
  classifySpenderRisk,
  parseSpenderInfoPayload,
} from './useSpenderRisk';

const NOW = 1_800_000_000;

describe('classifySpenderRisk', () => {
  it('flags EOA spenders as high-risk even if they are otherwise unknown', () => {
    const result = classifySpenderRisk({
      address: '0xFb3C2B2769A2119f349233A44A640F090C907667',
      isEoa: true,
      now: NOW,
    });

    expect(result.level).toBe('eoa');
    expect(result.codeVerified).toBe(true);
    expect(result.reason).toContain('普通钱包');
  });

  it('prioritizes attributable threat intelligence over other heuristics', () => {
    const result = classifySpenderRisk({
      address: '0xFb3C2B2769A2119f349233A44A640F090C907667',
      isEoa: false,
      malicious: true,
      threat: {
        status: 'available',
        sourceName: 'Scam Sniffer',
        sourceUrl: 'https://github.com/scamsniffer/scam-database',
        publicDelayDays: 7,
        checkedAt: NOW * 1000,
      },
      now: NOW,
    });

    expect(result.level).toBe('malicious');
    expect(result.threat.sourceName).toBe('Scam Sniffer');
  });

  it('marks trusted known contracts as known', () => {
    const result = classifySpenderRisk({
      address: '0xE592427A0AEce92De3Edee1F18E0157C05861564',
      isEoa: false,
      now: NOW,
    });

    expect(result.level).toBe('known');
    expect(result.labelName).toBe('Uniswap V3 Router');
  });

  it('marks recently deployed unknown contracts as new', () => {
    const result = classifySpenderRisk({
      address: '0x2222222222222222222222222222222222222222',
      isEoa: false,
      createdAt: NOW - 3 * 86400,
      now: NOW,
    });

    expect(result.level).toBe('new');
    expect(result.reason).toContain('3 天前部署');
  });

  it('does not classify an RPC failure as an EOA', () => {
    const result = classifySpenderRisk({
      address: '0x2222222222222222222222222222222222222222',
      isEoa: undefined,
      now: NOW,
    });

    expect(result.level).toBe('unknown');
    expect(result.codeVerified).toBe(false);
    expect(result.reason).toContain('RPC');
  });
});

describe('parseSpenderInfoPayload', () => {
  it('keeps only safe timestamps and normalizes keys', () => {
    expect(
      parseSpenderInfoPayload({
        created: {
          '0xABC': 1_700_000_000,
          '0xDEF': null,
          bad: Number.NaN,
          negative: -1,
        },
      }),
    ).toMatchObject({
      created: { '0xabc': 1_700_000_000, '0xdef': null },
      threat: { status: 'unavailable' },
    });
  });

  it('parses malicious matches and source freshness separately from contract age', () => {
    const result = parseSpenderInfoPayload({
      created: {},
      threat: {
        status: 'available',
        malicious: ['0xFb3C2B2769A2119f349233A44A640F090C907667'],
        checkedAt: 1_800_000_000_000,
        stale: false,
        source: {
          name: 'Scam Sniffer',
          repositoryUrl: 'https://github.com/scamsniffer/scam-database',
          publicDelayDays: 7,
        },
      },
    });

    expect([...result.malicious]).toEqual([
      '0xfb3c2b2769a2119f349233a44a640f090c907667',
    ]);
    expect(result.threat).toMatchObject({
      status: 'available',
      checkedAt: 1_800_000_000_000,
    });
  });
});
