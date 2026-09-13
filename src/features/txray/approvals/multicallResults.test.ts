import { describe, expect, it } from 'vitest';
import {
  readBigIntResult,
  readBooleanResult,
  readPermit2Result,
  readSuccessResult,
} from './multicallResults';

describe('multicall result guards', () => {
  it('reads successful values with the expected runtime type', () => {
    expect(readBigIntResult({ status: 'success', result: 2n })).toBe(2n);
    expect(readBooleanResult({ status: 'success', result: false })).toBe(false);
    expect(
      readPermit2Result({ status: 'success', result: [1n, 2n, 3n] }),
    ).toEqual([1n, 2n, 3n]);
    expect(readSuccessResult({ status: 'success', result: 'TOKEN' })).toBe('TOKEN');
  });

  it('rejects failed or incorrectly typed values', () => {
    expect(readBigIntResult({ status: 'failure', result: 2n })).toBeUndefined();
    expect(readBooleanResult({ status: 'success', result: 0 })).toBeUndefined();
    expect(
      readPermit2Result({ status: 'success', result: [1n, 2n] }),
    ).toBeUndefined();
  });
});
