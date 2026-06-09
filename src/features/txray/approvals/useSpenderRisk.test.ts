import { describe, expect, it } from 'vitest';
import { classifySpenderRisk } from './useSpenderRisk';

const NOW = 1_800_000_000;

describe('classifySpenderRisk', () => {
  it('flags EOA spenders as high-risk even if they are otherwise unknown', () => {
    const result = classifySpenderRisk({
      address: '0xFb3C2B2769A2119f349233A44A640F090C907667',
      isEoa: true,
      now: NOW,
    });

    expect(result.level).toBe('eoa');
    expect(result.reason).toContain('普通钱包');
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
});
