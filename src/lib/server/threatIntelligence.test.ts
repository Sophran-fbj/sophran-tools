import { describe, expect, it } from 'vitest';
import { parseThreatAddressFeed } from './threatIntelligence';

describe('parseThreatAddressFeed', () => {
  it('validates, normalizes, and deduplicates EVM addresses', () => {
    const result = parseThreatAddressFeed([
      '0xFb3C2B2769A2119f349233A44A640F090C907667',
      '0xfb3c2b2769a2119f349233a44a640f090c907667',
    ]);

    expect([...result]).toEqual([
      '0xfb3c2b2769a2119f349233a44a640f090c907667',
    ]);
  });

  it('rejects malformed feeds instead of silently dropping entries', () => {
    expect(() => parseThreatAddressFeed(['not-an-address'])).toThrow(
      '包含无效地址',
    );
    expect(() => parseThreatAddressFeed({})).toThrow('无效列表');
  });
});
